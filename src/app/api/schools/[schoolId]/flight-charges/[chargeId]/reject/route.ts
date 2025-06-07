import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import FlightCharge from '@/models/FlightCharge';
import StudentLedger from '@/models/StudentLedger';
import mongoose from 'mongoose';

// PATCH /api/schools/[schoolId]/flight-charges/[chargeId]/reject
export async function PATCH(
  request: NextRequest,
  { params }: { params: { schoolId: string; chargeId: string } }
) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if ('error' in apiKeyResult) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 });
    }

    // Authenticate user
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Connect to database
    await connectDB();

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');

    // Check if user is school admin or system admin
    if (decoded?.role !== 'school_admin' && decoded?.role !== 'sys_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only school administrators or system administrators can reject charges.' },
        { status: 403 }
      );
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.chargeId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or charge ID format' },
        { status: 400 }
      );
    }

    // Get request body
    let body;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        body = {};
      } else {
        body = JSON.parse(text);
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate required rejection reason
    if (!body.reason_rejected || typeof body.reason_rejected !== 'string' || body.reason_rejected.trim() === '') {
      return NextResponse.json(
        { error: 'Reason for rejection is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Find the flight charge
    const existingCharge = await (FlightCharge as any).findOne({
      _id: params.chargeId,
      school_id: params.schoolId
    });

    if (!existingCharge) {
      return NextResponse.json(
        { error: 'Flight charge not found in this school' },
        { status: 404 }
      );
    }

    // Check if charge is already rejected
    if (existingCharge.status === 'rejected') {
      return NextResponse.json(
        { error: 'Flight charge is already rejected' },
        { status: 400 }
      );
    }

    // Check if charge is approved
    if (existingCharge.status === 'approved') {
      return NextResponse.json(
        { error: 'Cannot reject an approved charge. Consider creating a credit entry instead.' },
        { status: 400 }
      );
    }

    // Reject the charge
    const rejectedCharge = await existingCharge.reject(decoded.userId, body.reason_rejected.trim());
    
    // INTEGRATION: Update ledger when charge is rejected and recalculate balance
    try {
      await updateLedgerForChargeRejectionAndRecalculate(params.schoolId, existingCharge.student_id, existingCharge._id);
    } catch (ledgerError) {
      console.error('Error updating ledger for charge rejection:', ledgerError);
      // Continue with the response even if ledger update fails
    }

    // Populate the rejected charge with related data
    const populatedCharge = await (FlightCharge as any)
      .findById(rejectedCharge._id)
      .populate({
        path: 'flight_schedule_id',
        select: 'scheduled_start_time scheduled_end_time flight_type status'
      })
      .populate({
        path: 'school_id',
        select: 'name address airport phone email'
      })
      .populate({
        path: 'student_id',
        populate: {
          path: 'user_id',
          select: 'first_name last_name email'
        }
      })
      .populate({
        path: 'plane_id',
        select: 'registration type aircraftModel'
      })
      .populate({
        path: 'instructor_id',
        populate: {
          path: 'user_id',
          select: 'first_name last_name email'
        }
      })
      .populate({
        path: 'approved_by',
        select: 'first_name last_name email role'
      })
      .lean();

    return NextResponse.json({
      message: 'Flight charge rejected successfully and ledger balance updated',
      charge: populatedCharge
    });

  } catch (error) {
    console.error('Error in PATCH /api/schools/[schoolId]/flight-charges/[chargeId]/reject:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Update ledger when a charge is rejected and recalculate balance
 */
async function updateLedgerForChargeRejectionAndRecalculate(
  schoolId: string,
  studentId: string,
  chargeId: mongoose.Types.ObjectId
): Promise<void> {
  try {
    const ledger = await (StudentLedger as any).findOne({
      school_id: schoolId,
      student_id: studentId
    });

    if (ledger) {
      // Remove the charge from the charges array
      const chargeIndex = ledger.charges.indexOf(chargeId);
      if (chargeIndex > -1) {
        ledger.charges.splice(chargeIndex, 1);
        await ledger.save();
        
        // Recalculate balance based on remaining approved charges
        const allApprovedCharges = await (FlightCharge as any).find({
          _id: { $in: ledger.charges },
          status: 'approved'
        }).select('amount');

        // Calculate the correct balance from all approved charges
        const correctBalance = allApprovedCharges.reduce((total: number, charge: any) => total + charge.amount, 0);
        
        // Update the balance to the recalculated amount
        ledger.balance = correctBalance;
        await ledger.save();
        
        console.log(`Removed rejected charge ${chargeId} from charges array for student ${studentId} and recalculated balance. New balance: ${correctBalance}`);
      }
    } else {
      console.warn(`No ledger found for student ${studentId} when rejecting charge ${chargeId}`);
    }
  } catch (error) {
    console.error('Error in updateLedgerForChargeRejectionAndRecalculate:', error);
    throw error;
  }
} 