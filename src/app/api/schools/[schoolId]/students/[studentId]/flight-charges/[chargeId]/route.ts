import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import FlightCharge from '@/models/FlightCharge';
import StudentLedger from '@/models/StudentLedger';
import Student from '@/models/Student';
import mongoose from 'mongoose';

// GET /api/schools/[schoolId]/students/[studentId]/flight-charges/[chargeId] - Get specific flight charge
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string; studentId: string; chargeId: string } }
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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || 
        !mongoose.Types.ObjectId.isValid(params.studentId) ||
        !mongoose.Types.ObjectId.isValid(params.chargeId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Find the flight charge with populated data
    const charge = await (FlightCharge as any)
      .findOne({
        _id: params.chargeId,
        school_id: params.schoolId,
        student_id: params.studentId
      })
      .populate({
        path: 'flight_schedule_id',
        select: 'scheduled_start_time scheduled_end_time flight_type status actual_start_time actual_end_time'
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
        path: 'created_by',
        select: 'first_name last_name email role'
      })
      .populate({
        path: 'approved_by',
        select: 'first_name last_name email role'
      })
      .lean();

    if (!charge) {
      return NextResponse.json(
        { error: 'Flight charge not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ charge });

  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/students/[studentId]/flight-charges/[chargeId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId]/students/[studentId]/flight-charges/[chargeId] - Update flight charge
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string; studentId: string; chargeId: string } }
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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || 
        !mongoose.Types.ObjectId.isValid(params.studentId) ||
        !mongoose.Types.ObjectId.isValid(params.chargeId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Get current user from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    if (!decoded?.userId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Find existing charge
    const existingCharge = await (FlightCharge as any).findOne({
      _id: params.chargeId,
      school_id: params.schoolId,
      student_id: params.studentId
    });

    if (!existingCharge) {
      return NextResponse.json(
        { error: 'Flight charge not found' },
        { status: 404 }
      );
    }

    // Get request body
    const body = await request.json();

    // Handle special approval/rejection operations
    if (body.action === 'approve') {
      const approvedCharge = await existingCharge.approve(decoded.userId);
      
      // INTEGRATION: Update ledger when charge is approved AND recalculate balance for accuracy
      try {
        await updateLedgerForChargeApprovalAndRecalculate(params.schoolId, params.studentId, existingCharge._id, existingCharge.amount);
      } catch (ledgerError) {
        console.error('Error updating ledger for charge approval:', ledgerError);
        // Continue with the response even if ledger update fails
      }

      const populatedCharge = await (FlightCharge as any)
        .findById(approvedCharge._id)
        .populate({
          path: 'flight_schedule_id',
          select: 'scheduled_start_time scheduled_end_time flight_type status'
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
    }

    if (body.action === 'reject') {
      if (!body.reason_rejected) {
        return NextResponse.json(
          { error: 'Reason for rejection is required' },
          { status: 400 }
        );
      }

      const rejectedCharge = await existingCharge.reject(decoded.userId, body.reason_rejected);
      
      // INTEGRATION: Update ledger when charge is rejected and recalculate balance
      try {
        await updateLedgerForChargeRejectionAndRecalculate(params.schoolId, params.studentId, existingCharge._id);
      } catch (ledgerError) {
        console.error('Error updating ledger for charge rejection:', ledgerError);
        // Continue with the response even if ledger update fails
      }

      const populatedCharge = await (FlightCharge as any)
        .findById(rejectedCharge._id)
        .populate({
          path: 'flight_schedule_id',
          select: 'scheduled_start_time scheduled_end_time flight_type status'
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
    }

    // Regular update operations
    // Validate numeric fields if provided
    if (body.duration !== undefined && (typeof body.duration !== 'number' || body.duration < 0)) {
      return NextResponse.json(
        { error: 'Duration must be a non-negative number' },
        { status: 400 }
      );
    }

    if (body.amount !== undefined && typeof body.amount !== 'number') {
      return NextResponse.json(
        { error: 'Amount must be a number' },
        { status: 400 }
      );
    }

    if (body.rate_override !== undefined && body.rate_override !== null && 
        (typeof body.rate_override !== 'number' || body.rate_override < 0)) {
      return NextResponse.json(
        { error: 'Rate override must be a non-negative number' },
        { status: 400 }
      );
    }

    // Validate ObjectId fields if provided
    const objectIdFields = ['flight_schedule_id', 'plane_id', 'instructor_id'];
    for (const field of objectIdFields) {
      if (body[field] && !mongoose.Types.ObjectId.isValid(body[field])) {
        return NextResponse.json(
          { error: `Invalid ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate status if provided
    if (body.status && !['pending', 'approved', 'rejected'].includes(body.status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }

    // If status is being changed to approved or rejected, set approved_by
    if (body.status === 'approved' || body.status === 'rejected') {
      body.approved_by = decoded.userId;
    }

    // Update the flight charge
    const updatedCharge = await (FlightCharge as any).findByIdAndUpdate(
      params.chargeId,
      { $set: body },
      { new: true, runValidators: true }
    )
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
      path: 'created_by',
      select: 'first_name last_name email role'
    })
    .populate({
      path: 'approved_by',
      select: 'first_name last_name email role'
    })
    .lean();

    if (!updatedCharge) {
      return NextResponse.json(
        { error: 'Failed to update flight charge' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Flight charge updated successfully',
      charge: updatedCharge
    });

  } catch (error) {
    console.error('Error in PUT /api/schools/[schoolId]/students/[studentId]/flight-charges/[chargeId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/students/[studentId]/flight-charges/[chargeId] - Delete flight charge
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; studentId: string; chargeId: string } }
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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || 
        !mongoose.Types.ObjectId.isValid(params.studentId) ||
        !mongoose.Types.ObjectId.isValid(params.chargeId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Get user role from token for permission check
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';
    const isSchoolAdmin = decoded?.role === 'school_admin';

    // Only system admins and school admins should be able to delete charges
    if (!isSystemAdmin && !isSchoolAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete flight charge' },
        { status: 403 }
      );
    }

    // Check if charge exists and is pending (approved charges should not be deleted)
    const existingCharge = await (FlightCharge as any).findOne({
      _id: params.chargeId,
      school_id: params.schoolId,
      student_id: params.studentId
    });

    if (!existingCharge) {
      return NextResponse.json(
        { error: 'Flight charge not found' },
        { status: 404 }
      );
    }

    // Prevent deletion of approved charges unless system admin
    if (existingCharge.status === 'approved' && !isSystemAdmin) {
      return NextResponse.json(
        { error: 'Cannot delete approved charges. Only system administrators can delete approved charges.' },
        { status: 403 }
      );
    }

    // INTEGRATION: Update ledger when charge is deleted
    try {
      await removeChargeFromStudentLedgerAndRecalculate(params.schoolId, params.studentId, existingCharge._id);
    } catch (ledgerError) {
      console.error('Error removing charge from student ledger:', ledgerError);
      // Continue with deletion even if ledger update fails
    }

    // Delete the flight charge
    const deletedCharge = await (FlightCharge as any).findByIdAndDelete(params.chargeId);

    if (!deletedCharge) {
      return NextResponse.json(
        { error: 'Failed to delete flight charge' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Flight charge deleted successfully and ledger balance recalculated',
      charge_id: params.chargeId
    });

  } catch (error) {
    console.error('Error in DELETE /api/schools/[schoolId]/students/[studentId]/flight-charges/[chargeId]:', error);
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
  chargeId: mongoose.Types.ObjectId,
  chargeAmount: number
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
        await recalculateStudentLedgerBalance(schoolId, studentId);
        
        console.log(`Removed rejected charge ${chargeId} from charges array for student ${studentId} and recalculated balance`);
      }
    } else {
      console.warn(`No ledger found for student ${studentId} when rejecting charge ${chargeId}`);
    }
  } catch (error) {
    console.error('Error in updateLedgerForChargeRejectionAndRecalculate:', error);
    throw error;
  }
}

/**
 * Recalculate student ledger balance based on all approved charges
 */
async function recalculateStudentLedgerBalance(
  schoolId: string,
  studentId: string
): Promise<number> {
  try {
    const ledger = await (StudentLedger as any).findOne({
      school_id: schoolId,
      student_id: studentId
    });

    if (!ledger) {
      console.warn(`No ledger found for student ${studentId} when recalculating balance`);
      return 0;
    }

    // Get all approved charges for this student
    const allApprovedCharges = await (FlightCharge as any).find({
      _id: { $in: ledger.charges },
      status: 'approved'
    }).select('amount');

    // Calculate the correct balance from all approved charges
    const correctBalance = allApprovedCharges.reduce((total: number, charge: any) => total + charge.amount, 0);
    
    // Update the balance
    ledger.balance = correctBalance;
    await ledger.save();
    
    console.log(`Recalculated balance for student ${studentId}. Total approved charges: ${allApprovedCharges.length}, Balance: ${correctBalance}`);
    
    return correctBalance;
  } catch (error) {
    console.error('Error in recalculateStudentLedgerBalance:', error);
    throw error;
  }
}

/**
 * Remove a charge from the student's ledger when deleted and recalculate balance
 */
async function removeChargeFromStudentLedgerAndRecalculate(
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
        await recalculateStudentLedgerBalance(schoolId, studentId);
        
        console.log(`Removed charge ${chargeId} from ledger for student ${studentId} and recalculated balance`);
      }
    } else {
      console.warn(`No ledger found for student ${studentId} when deleting charge ${chargeId}`);
    }
  } catch (error) {
    console.error('Error in removeChargeFromStudentLedgerAndRecalculate:', error);
    throw error;
  }
} 