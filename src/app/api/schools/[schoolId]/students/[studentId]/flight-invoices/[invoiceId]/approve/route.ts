import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { verifyToken } from '@/lib/jwt';
import FlightInvoice from '@/models/FlightInvoice';
import StudentLedger from '@/models/StudentLedger';
import mongoose from 'mongoose';

// POST /api/schools/[schoolId]/students/[studentId]/flight-invoices/[invoiceId]/approve
// Approve a pending invoice and add it to the student ledger
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string; studentId: string; invoiceId: string } }
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
        !mongoose.Types.ObjectId.isValid(params.invoiceId)) {
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

    // Check permissions - only school admins and system admins can approve invoices
    if (decoded.role !== 'school_admin' && decoded.role !== 'sys_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only school or system administrators can approve invoices.' },
        { status: 403 }
      );
    }

    // Find the invoice
    const invoice = await (FlightInvoice as any).findOne({
      _id: params.invoiceId,
      school_id: params.schoolId,
      student_id: params.studentId
    }).populate('flight_schedule_id');

    if (!invoice) {
      return NextResponse.json(
        { error: 'Flight invoice not found' },
        { status: 404 }
      );
    }

    // Check if invoice can be approved
    if (invoice.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending invoices can be approved' },
        { status: 400 }
      );
    }

    // Update invoice status to approved
    invoice.status = 'approved';
    invoice.approved_by = decoded.userId;
    invoice.approved_at = new Date();
    await invoice.save();

    // Add invoice amount to student ledger
    try {
      await addInvoiceToStudentLedger(
        params.schoolId,
        params.studentId,
        invoice._id,
        invoice.total_amount
      );
    } catch (ledgerError) {
      console.error('Error adding invoice to student ledger:', ledgerError);
      // If ledger update fails, we should still return success but log the issue
      console.warn(`Invoice ${invoice._id} approved but failed to update student ledger for student ${params.studentId}`);
    }

    // Populate the updated invoice for response
    const populatedInvoice = await (FlightInvoice as any)
      .findById(invoice._id)
      .populate({
        path: 'flight_schedule_id',
        select: 'scheduled_start_time scheduled_end_time flight_type status'
      })
      .populate({
        path: 'approved_by',
        select: 'first_name last_name email role'
      })
      .populate({
        path: 'created_by',
        select: 'first_name last_name email role'
      })
      .lean();

    return NextResponse.json({
      message: 'Invoice approved successfully and added to student ledger',
      invoice: populatedInvoice
    });

  } catch (error) {
    console.error('Error in POST approve invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Add an approved invoice to the student's ledger, creating the ledger if it doesn't exist
 */
async function addInvoiceToStudentLedger(
  schoolId: string, 
  studentId: string, 
  invoiceId: mongoose.Types.ObjectId, 
  invoiceAmount: number
): Promise<void> {
  try {
    // Try to find existing ledger
    let ledger = await (StudentLedger as any).findOne({
      school_id: schoolId,
      student_id: studentId
    });

    if (!ledger) {
      // Create new ledger if it doesn't exist
      console.log(`Creating new ledger for student ${studentId} in school ${schoolId}`);
      ledger = new StudentLedger({
        school_id: schoolId,
        student_id: studentId,
        balance: 0.00,
        charges: [],
        payments: []
      });
    }

    // Add the invoice to the charges array (we'll use charges array for approved invoices)
    if (!ledger.charges.includes(invoiceId)) {
      ledger.charges.push(invoiceId);
    }

    // Update the balance with the approved invoice amount
    ledger.balance += invoiceAmount;

    // Save the ledger
    await ledger.save();

    console.log(`Successfully added approved invoice ${invoiceId} (amount: ${invoiceAmount}) to student ${studentId} ledger. New balance: ${ledger.balance}`);

  } catch (error) {
    console.error('Error in addInvoiceToStudentLedger:', error);
    throw error; // Re-throw to be handled by calling function
  }
} 