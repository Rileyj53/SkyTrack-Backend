import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { verifyToken } from '@/lib/jwt';
import FlightInvoice from '@/models/FlightInvoice';
import mongoose from 'mongoose';

// POST /api/schools/[schoolId]/students/[studentId]/flight-invoices/[invoiceId]/finalize
// Submit an invoice for approval (changes status from draft to pending)
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

    // Check permissions - only school admins and system admins can finalize invoices
    if (decoded.role !== 'school_admin' && decoded.role !== 'sys_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only school or system administrators can finalize invoices.' },
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

    // Check if invoice can be finalized
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft invoices can be finalized' },
        { status: 400 }
      );
    }

    // Update invoice status to pending for approval
    invoice.status = 'pending';
    await invoice.save();

    // Populate the updated invoice for response
    const populatedInvoice = await (FlightInvoice as any)
      .findById(invoice._id)
      .populate({
        path: 'flight_schedule_id',
        select: 'scheduled_start_time scheduled_end_time flight_type status'
      })
      .populate({
        path: 'created_by',
        select: 'first_name last_name email role'
      })
      .lean();

    return NextResponse.json({
      message: 'Invoice submitted for approval successfully',
      invoice: populatedInvoice
    });

  } catch (error) {
    console.error('Error in POST finalize invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

 