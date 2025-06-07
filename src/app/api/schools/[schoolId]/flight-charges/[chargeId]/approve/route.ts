import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import FlightCharge from '@/models/FlightCharge';
import StudentLedger from '@/models/StudentLedger';
import mongoose from 'mongoose';

// PATCH /api/schools/[schoolId]/flight-charges/[chargeId]/approve
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
        { error: 'Insufficient permissions. Only school administrators or system administrators can approve charges.' },
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

    // Check if charge is already approved
    if (existingCharge.status === 'approved') {
      return NextResponse.json(
        { error: 'Flight charge is already approved' },
        { status: 400 }
      );
    }

    // Check if charge is rejected
    if (existingCharge.status === 'rejected') {
      return NextResponse.json(
        { error: 'Cannot approve a rejected charge. Create a new charge instead.' },
        { status: 400 }
      );
    }

    // Approve the charge
    const approvedCharge = await existingCharge.approve(decoded.userId);
    
    // INTEGRATION: Update ledger when charge is approved AND recalculate balance for accuracy
    try {
      await updateLedgerForChargeApprovalAndRecalculate(params.schoolId, existingCharge.student_id, existingCharge._id);
    } catch (ledgerError) {
      console.error('Error updating ledger for charge approval:', ledgerError);
      // Continue with the response even if ledger update fails
    }

    // Populate the approved charge with related data
    const populatedCharge = await (FlightCharge as any)
      .findById(approvedCharge._id)
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
      message: 'Flight charge approved successfully and ledger balance updated',
      charge: populatedCharge
    });

  } catch (error) {
    console.error('Error in PATCH /api/schools/[schoolId]/flight-charges/[chargeId]/approve:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Update ledger when a charge is approved and recalculate balance for accuracy
 */
async function updateLedgerForChargeApprovalAndRecalculate(
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
      // Ensure the charge is in the charges array (it should be from creation)
      if (!ledger.charges.includes(chargeId)) {
        ledger.charges.push(chargeId);
      }
      
      // RECALCULATE BALANCE: Get all approved charges for this student and recalculate total
      const allApprovedCharges = await (FlightCharge as any).find({
        _id: { $in: ledger.charges },
        status: 'approved'
      }).select('amount');

      // Calculate the correct balance from all approved charges
      const correctBalance = allApprovedCharges.reduce((total: number, charge: any) => total + charge.amount, 0);
      
      // Update the balance to the recalculated amount
      ledger.balance = correctBalance;
      await ledger.save();
      
      console.log(`Recalculated balance for student ${studentId}. Total approved charges: ${allApprovedCharges.length}, New balance: ${correctBalance}`);
      
    } else {
      console.warn(`No ledger found for student ${studentId} when approving charge ${chargeId}`);
    }
  } catch (error) {
    console.error('Error in updateLedgerForChargeApprovalAndRecalculate:', error);
    throw error;
  }
} 