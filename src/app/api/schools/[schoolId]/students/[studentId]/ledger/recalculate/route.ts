import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import StudentLedger from '@/models/StudentLedger';
import FlightCharge from '@/models/FlightCharge';
import Student from '@/models/Student';
import mongoose from 'mongoose';

// POST /api/schools/[schoolId]/students/[studentId]/ledger/recalculate - Recalculate student ledger balance
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string; studentId: string } }
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
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.studentId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or student ID format' },
        { status: 400 }
      );
    }

    // Check if student exists and belongs to the school
    const student = await (Student as any).findOne({
      _id: params.studentId,
      school_id: params.schoolId
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found in this school' },
        { status: 404 }
      );
    }

    // Find the student ledger
    const ledger = await (StudentLedger as any).findOne({
      student_id: params.studentId,
      school_id: params.schoolId
    });

    if (!ledger) {
      return NextResponse.json(
        { error: 'Student ledger not found' },
        { status: 404 }
      );
    }

    // Store old balance for comparison
    const oldBalance = ledger.balance;

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
    
    // Calculate the difference
    const balanceDifference = correctBalance - oldBalance;
    
    console.log(`Manual recalculation for student ${params.studentId}: Old balance: ${oldBalance}, New balance: ${correctBalance}, Difference: ${balanceDifference}`);
    
    return NextResponse.json({
      message: 'Ledger balance recalculated successfully',
      recalculation: {
        old_balance: oldBalance,
        new_balance: correctBalance,
        difference: balanceDifference,
        approved_charges_count: allApprovedCharges.length,
        total_charges_in_ledger: ledger.charges.length
      }
    });

  } catch (error) {
    console.error('Error in POST /api/schools/[schoolId]/students/[studentId]/ledger/recalculate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 