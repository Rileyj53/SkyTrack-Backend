import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { verifyToken } from '@/lib/jwt';
import StudentLedger from '@/models/StudentLedger';
import Student from '@/models/Student';
import mongoose from 'mongoose';

// Import FlightCharge to ensure the model is registered
import '@/models/FlightCharge';

// POST /api/schools/[schoolId]/students/[studentId]/ledger/recalculate - Recalculate student ledger balance
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string; studentId: string } }
) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }

    // Authenticate user
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) {
      return authResult;
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
    const allApprovedCharges = await mongoose.model('FlightCharge').find({
      _id: { $in: ledger.charges },
      status: 'approved'
    }).select('amount');

    // Calculate total charges
    const totalCharges = allApprovedCharges.reduce((total: number, charge: any) => total + charge.amount, 0);
    
    // Calculate total payments
    const totalPayments = ledger.payments.reduce((total: number, payment: any) => total + payment.amount, 0);
    
    // Calculate the correct balance: Total Charges - Total Payments
    const correctBalance = totalCharges - totalPayments;
    
    // Update the balance
    ledger.balance = correctBalance;
    await ledger.save();
    
    // Calculate the difference
    const balanceDifference = correctBalance - oldBalance;
    
    console.log(`Manual recalculation for student ${params.studentId}: Old balance: ${oldBalance}, New balance: ${correctBalance}, Difference: ${balanceDifference}`);
    console.log(`  - Total charges: ${totalCharges}, Total payments: ${totalPayments}`);
    
    return NextResponse.json({
      message: 'Ledger balance recalculated successfully',
      recalculation: {
        old_balance: oldBalance,
        new_balance: correctBalance,
        difference: balanceDifference,
        total_charges: totalCharges,
        total_payments: totalPayments,
        approved_charges_count: allApprovedCharges.length,
        total_charges_in_ledger: ledger.charges.length,
        payments_count: ledger.payments.length
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