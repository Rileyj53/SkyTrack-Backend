import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { verifyToken } from '@/lib/jwt';
import FlightInvoice from '@/models/FlightInvoice';
import mongoose from 'mongoose';

// POST /api/schools/[schoolId]/students/[studentId]/flight-invoices/[invoiceId]/reject
// Reject a pending invoice with a reason
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

    // Check permissions - only school admins and system admins can reject invoices
    if (decoded.role !== 'school_admin' && decoded.role !== 'sys_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only school or system administrators can reject invoices.' },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    const { reason_rejected } = body;

    // Validate rejection reason
    if (!reason_rejected || typeof reason_rejected !== 'string' || reason_rejected.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    if (reason_rejected.length > 500) {
      return NextResponse.json(
        { error: 'Rejection reason cannot exceed 500 characters' },
        { status: 400 }
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

    // Check if invoice can be rejected
    if (invoice.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending invoices can be rejected' },
        { status: 400 }
      );
    }

    // Update invoice status to rejected
    invoice.status = 'rejected';
    invoice.reason_rejected = reason_rejected.trim();
    invoice.approved_by = decoded.userId; // Track who rejected it
    invoice.approved_at = new Date(); // When it was rejected
    await invoice.save();

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
      message: 'Invoice rejected successfully',
      invoice: populatedInvoice
    });

  } catch (error) {
    console.error('Error in POST reject invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 