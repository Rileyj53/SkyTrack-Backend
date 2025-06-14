import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { verifyToken } from '@/lib/jwt';
import StudentLedger from '@/models/StudentLedger';
import Student from '@/models/Student';
import FlightInvoice from '@/models/FlightInvoice';
import mongoose from 'mongoose';

// POST /api/schools/[schoolId]/students/[studentId]/ledger/recalculate
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

    // Check authorization - only school admins and system admins can recalculate balances
    if (!['school_admin', 'system_admin'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions. Only administrators can recalculate balances.' }, { status: 403 });
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
    const student = await Student.findOne({
      _id: params.studentId,
      school_id: params.schoolId
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found in this school' },
        { status: 404 }
      );
    }

    // Find the student's ledger
    const ledger = await StudentLedger.findOne({
      school_id: params.schoolId,
      student_id: params.studentId
    });

    if (!ledger) {
      return NextResponse.json(
        { error: 'Ledger not found for this student' },
        { status: 404 }
      );
    }

    // Get all approved flight invoices for this student
    const allApprovedInvoices = await FlightInvoice.find({
      school_id: params.schoolId,
      student_id: params.studentId,
      status: 'approved'
    });

    // Calculate new balance from scratch based on approved invoices
    const chargeAmount = allApprovedInvoices.reduce((total, invoice) => {
      return total + (invoice.total_amount || 0);
    }, 0);
    
    // Calculate payment amount from existing payments in ledger
    const paymentAmount = ledger.payments.reduce((total: number, payment: any) => {
      return total + (payment.amount || 0);
    }, 0);

    const oldBalance = ledger.balance;
    const newBalance = chargeAmount - paymentAmount;
    const difference = newBalance - oldBalance;

    // Update the ledger
    ledger.balance = newBalance;
    ledger.last_updated = new Date();
    await ledger.save();

    return NextResponse.json({
      message: 'Ledger balance recalculated successfully',
      recalculation: {
        old_balance: oldBalance,
        new_balance: newBalance,
        difference,
        approved_invoices_count: allApprovedInvoices.length,
        total_charges_in_ledger: (ledger.charges || []).length,
        recalculated_at: new Date()
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