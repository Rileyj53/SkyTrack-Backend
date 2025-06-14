import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { verifyToken } from '@/lib/jwt';
import FlightInvoice from '@/models/FlightInvoice';
import FlightSchedule from '@/models/FlightSchedule';
import Student from '@/models/Student';
import mongoose from 'mongoose';

// GET /api/schools/[schoolId]/students/[studentId]/flight-invoices/[invoiceId] - Get a specific flight invoice
export async function GET(
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

    // Find the flight invoice with populated data
    const invoice = await (FlightInvoice as any)
      .findOne({
        _id: params.invoiceId,
        school_id: params.schoolId,
        student_id: params.studentId
      })
      .populate({
        path: 'flight_schedule_id',
        select: 'scheduled_start_time scheduled_end_time actual_duration scheduled_duration flight_type status notes'
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
        select: 'registration type aircraftModel hourlyRates status'
      })
      .populate({
        path: 'instructor_id',
        populate: {
          path: 'user_id',
          select: 'first_name last_name email'
        }
      })
      .populate({
        path: 'flight_charge_id',
        select: 'amount status created_at approved_at reason_rejected'
      })
      .populate({
        path: 'created_by',
        select: 'first_name last_name email role'
      })
      .lean();

    if (!invoice) {
      return NextResponse.json(
        { error: 'Flight invoice not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ invoice });

  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/students/[studentId]/flight-invoices/[invoiceId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId]/students/[studentId]/flight-invoices/[invoiceId] - Update a flight invoice
export async function PUT(
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

    // Find existing invoice
    const existingInvoice = await (FlightInvoice as any).findOne({
      _id: params.invoiceId,
      school_id: params.schoolId,
      student_id: params.studentId
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Flight invoice not found' },
        { status: 404 }
      );
    }

    // Check if invoice is still editable (only draft invoices can be edited)
    if (existingInvoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft invoices can be edited' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json();

    // Prepare update object
    const updateData: any = {};

    // Validate and update line items if provided
    if (body.line_items !== undefined) {
      if (!Array.isArray(body.line_items) || body.line_items.length === 0) {
        return NextResponse.json(
          { error: 'At least one line item is required' },
          { status: 400 }
        );
      }

      for (const item of body.line_items) {
        if (!item.name || !item.description || typeof item.quantity !== 'number' || typeof item.unit_rate !== 'number') {
          return NextResponse.json(
            { error: 'Each line item must have name, description, quantity, and unit_rate' },
            { status: 400 }
          );
        }
        if (item.quantity < 0 || item.unit_rate < 0) {
          return NextResponse.json(
            { error: 'Line item quantity and unit_rate cannot be negative' },
            { status: 400 }
          );
        }
        // Auto-calculate total for each line item
        item.total_amount = item.quantity * item.unit_rate;
      }

      updateData.line_items = body.line_items;
    }

    // Validate and update tax rate if provided
    if (body.tax_rate !== undefined) {
      if (typeof body.tax_rate !== 'number' || body.tax_rate < 0 || body.tax_rate > 100) {
        return NextResponse.json(
          { error: 'Tax rate must be a number between 0 and 100' },
          { status: 400 }
        );
      }
      updateData.tax_rate = body.tax_rate;
    }

    // Validate and update due date if provided
    if (body.due_date !== undefined) {
      if (body.due_date && isNaN(new Date(body.due_date).getTime())) {
        return NextResponse.json(
          { error: 'Invalid due_date format' },
          { status: 400 }
        );
      }
      updateData.due_date = body.due_date ? new Date(body.due_date) : null;
    }

    // Update currency if provided
    if (body.currency !== undefined) {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];
      if (!validCurrencies.includes(body.currency)) {
        return NextResponse.json(
          { error: 'Invalid currency code' },
          { status: 400 }
        );
      }
      updateData.currency = body.currency;
    }

    // Update notes if provided
    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    // Update status if provided (only certain transitions allowed)
    if (body.status !== undefined) {
      const validStatuses = ['draft', 'pending', 'sent', 'paid', 'overdue', 'cancelled'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }

      // Validate status transitions
      const currentStatus = existingInvoice.status;
      const newStatus = body.status;
      
      if (currentStatus === 'draft' && ['pending', 'cancelled'].includes(newStatus)) {
        updateData.status = newStatus;
      } else if (currentStatus === 'pending' && ['sent', 'cancelled'].includes(newStatus)) {
        updateData.status = newStatus;
      } else if (currentStatus === 'sent' && ['paid', 'overdue', 'cancelled'].includes(newStatus)) {
        updateData.status = newStatus;
        if (newStatus === 'paid') {
          updateData.paid_at = new Date();
        }
      } else if (currentStatus === 'overdue' && ['paid', 'cancelled'].includes(newStatus)) {
        updateData.status = newStatus;
        if (newStatus === 'paid') {
          updateData.paid_at = new Date();
        }
      } else {
        return NextResponse.json(
          { error: `Invalid status transition from ${currentStatus} to ${newStatus}` },
          { status: 400 }
        );
      }

      // Set sent_at timestamp when status changes to 'sent'
      if (newStatus === 'sent' && !existingInvoice.sent_at) {
        updateData.sent_at = new Date();
      }
    }

    // Update the flight invoice
    const updatedInvoice = await (FlightInvoice as any).findByIdAndUpdate(
      params.invoiceId,
      { $set: updateData },
      { new: true, runValidators: true }
    )
    .populate({
      path: 'flight_schedule_id',
      select: 'scheduled_start_time scheduled_end_time actual_duration scheduled_duration flight_type status notes'
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
      select: 'registration type aircraftModel hourlyRates status'
    })
    .populate({
      path: 'instructor_id',
      populate: {
        path: 'user_id',
        select: 'first_name last_name email'
      }
    })
    .populate({
      path: 'flight_charge_id',
      select: 'amount status created_at approved_at reason_rejected'
    })
    .populate({
      path: 'created_by',
      select: 'first_name last_name email role'
    })
    .lean();

    if (!updatedInvoice) {
      return NextResponse.json(
        { error: 'Failed to update flight invoice' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Flight invoice updated successfully',
      invoice: updatedInvoice
    });

  } catch (error) {
    console.error('Error in PUT /api/schools/[schoolId]/students/[studentId]/flight-invoices/[invoiceId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/students/[studentId]/flight-invoices/[invoiceId] - Delete a flight invoice
export async function DELETE(
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

    // Get user role from token for permission check
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';
    const isSchoolAdmin = decoded?.role === 'school_admin';

    // Find the invoice first
    const invoice = await (FlightInvoice as any).findOne({
      _id: params.invoiceId,
      school_id: params.schoolId,
      student_id: params.studentId
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Flight invoice not found' },
        { status: 404 }
      );
    }

    // Check permissions - only admins can delete, and rules based on status
    if (!isSystemAdmin && !isSchoolAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete invoice' },
        { status: 403 }
      );
    }

    // Only allow deletion of draft or cancelled invoices
    if (!['draft', 'cancelled'].includes(invoice.status)) {
      return NextResponse.json(
        { error: 'Only draft or cancelled invoices can be deleted' },
        { status: 400 }
      );
    }

    // If the invoice has a linked flight charge, prevent deletion
    if (invoice.flight_charge_id) {
      return NextResponse.json(
        { error: 'Cannot delete invoice that has been converted to flight charge' },
        { status: 400 }
      );
    }

    // Delete the invoice
    await (FlightInvoice as any).findByIdAndDelete(params.invoiceId);

    return NextResponse.json({
      message: 'Flight invoice deleted successfully',
      invoice_id: params.invoiceId
    });

  } catch (error) {
    console.error('Error in DELETE /api/schools/[schoolId]/students/[studentId]/flight-invoices/[invoiceId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 