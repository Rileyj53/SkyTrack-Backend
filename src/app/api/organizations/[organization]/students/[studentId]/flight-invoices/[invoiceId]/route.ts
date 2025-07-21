import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import FlightInvoice from '@/models/FlightInvoice';
import FlightSchedule from '@/models/FlightSchedule';
import Student from '@/models/Student';
import mongoose from 'mongoose';

// Security configuration for individual flight invoice operations
const FLIGHT_INVOICE_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: false, // GET operations don't need CSRF
  allowedRoles: ['sys_admin', 'school_admin', 'instructor'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000,
    slidingWindow: true
  }
};

const FLIGHT_INVOICE_MODIFY_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // PUT/DELETE operations need CSRF
  allowedRoles: ['sys_admin', 'school_admin', 'instructor'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 50,
    windowMs: 60000,
    slidingWindow: true
  }
};

const FLIGHT_INVOICE_DELETE_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  allowedRoles: ['sys_admin', 'school_admin'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 20,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET /api/organizations/[organizationId]/students/[studentId]/flight-invoices/[invoiceId] - Get a specific flight invoice
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organizationId: string, studentId: string, invoiceId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight invoice details request',
    auditId: securityContext.auditId,
    organizationId: params.organizationId,
    studentId: params.studentId,
    invoiceId: params.invoiceId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organizationId) || 
      !mongoose.Types.ObjectId.isValid(params.studentId) ||
      !mongoose.Types.ObjectId.isValid(params.invoiceId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find the flight invoice with populated data (still using organization_id in database for now)
  const invoice = await (FlightInvoice as any)
    .findOne({
      _id: params.invoiceId,
      organization_id: params.organizationId,
      student_id: params.studentId
    })
    .populate({
      path: 'flight_schedule_id',
      select: 'scheduled_start_time scheduled_end_time actual_duration scheduled_duration flight_type status notes'
    })
    .populate({
      path: 'organization_id',
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
    return NextResponse.json({
      error: {
        message: 'Flight invoice not found',
        code: 'INVOICE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight invoice details retrieved successfully',
    auditId: securityContext.auditId,
    organizationId: params.organizationId,
    studentId: params.studentId,
    invoiceId: params.invoiceId,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight invoice retrieved successfully',
    data: { invoice },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_INVOICE_SECURITY_CONFIG);

// PUT /api/organizations/[organizationId]/students/[studentId]/flight-invoices/[invoiceId] - Update a flight invoice
export const PUT = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organizationId: string, studentId: string, invoiceId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight invoice update request',
    auditId: securityContext.auditId,
    organizationId: params.organizationId,
    studentId: params.studentId,
    invoiceId: params.invoiceId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organizationId) || 
      !mongoose.Types.ObjectId.isValid(params.studentId) ||
      !mongoose.Types.ObjectId.isValid(params.invoiceId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find existing invoice (still using organization_id in database for now)
  const existingInvoice = await (FlightInvoice as any).findOne({
    _id: params.invoiceId,
    organization_id: params.organizationId,
    student_id: params.studentId
  });

  if (!existingInvoice) {
    return NextResponse.json({
      error: {
        message: 'Flight invoice not found',
        code: 'INVOICE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Check if invoice is still editable (only draft invoices can be edited)
  if (existingInvoice.status !== 'draft') {
    return NextResponse.json({
      error: {
        message: 'Only draft invoices can be edited',
        code: 'INVOICE_NOT_EDITABLE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Get request body
  const body = await request.json();

  // Prepare update object
  const updateData: any = {};

  // Validate and update line items if provided
  if (body.line_items !== undefined) {
    if (!Array.isArray(body.line_items) || body.line_items.length === 0) {
      return NextResponse.json({
        error: {
          message: 'At least one line item is required',
          code: 'MISSING_LINE_ITEMS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    for (const item of body.line_items) {
      if (!item.name || !item.description || typeof item.quantity !== 'number' || typeof item.unit_rate !== 'number') {
        return NextResponse.json({
          error: {
            message: 'Each line item must have name, description, quantity, and unit_rate',
            code: 'INVALID_LINE_ITEM',
            requestId: securityContext.auditId,
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
      if (item.quantity < 0 || item.unit_rate < 0) {
        return NextResponse.json({
          error: {
            message: 'Line item quantity and unit_rate cannot be negative',
            code: 'NEGATIVE_LINE_ITEM_VALUES',
            requestId: securityContext.auditId,
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
      // Auto-calculate total for each line item
      item.total_amount = item.quantity * item.unit_rate;
    }

    updateData.line_items = body.line_items;
  }

  // Validate and update tax rate if provided
  if (body.tax_rate !== undefined) {
    if (typeof body.tax_rate !== 'number' || body.tax_rate < 0 || body.tax_rate > 100) {
      return NextResponse.json({
        error: {
          message: 'Tax rate must be a number between 0 and 100',
          code: 'INVALID_TAX_RATE',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
    updateData.tax_rate = body.tax_rate;
  }

  // Validate and update due date if provided
  if (body.due_date !== undefined) {
    if (body.due_date && isNaN(new Date(body.due_date).getTime())) {
      return NextResponse.json({
        error: {
          message: 'Invalid due_date format',
          code: 'INVALID_DUE_DATE',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
    updateData.due_date = body.due_date ? new Date(body.due_date) : null;
  }

  // Update currency if provided
  if (body.currency !== undefined) {
    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];
    if (!validCurrencies.includes(body.currency)) {
      return NextResponse.json({
        error: {
          message: 'Invalid currency code',
          code: 'INVALID_CURRENCY',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
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
      return NextResponse.json({
        error: {
          message: 'Invalid status',
          code: 'INVALID_STATUS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
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
      return NextResponse.json({
        error: {
          message: `Invalid status transition from ${currentStatus} to ${newStatus}`,
          code: 'INVALID_STATUS_TRANSITION',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
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
    path: 'organization_id',
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
    return NextResponse.json({
      error: {
        message: 'Failed to update flight invoice',
        code: 'UPDATE_FAILED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight invoice updated successfully',
    auditId: securityContext.auditId,
    organizationId: params.organizationId,
    studentId: params.studentId,
    invoiceId: params.invoiceId,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight invoice updated successfully',
    data: { invoice: updatedInvoice },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_INVOICE_MODIFY_SECURITY_CONFIG);

// DELETE /api/organizations/[organizationId]/students/[studentId]/flight-invoices/[invoiceId] - Delete a flight invoice
export const DELETE = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organizationId: string, studentId: string, invoiceId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight invoice deletion request',
    auditId: securityContext.auditId,
    organizationId: params.organizationId,
    studentId: params.studentId,
    invoiceId: params.invoiceId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organizationId) || 
      !mongoose.Types.ObjectId.isValid(params.studentId) ||
      !mongoose.Types.ObjectId.isValid(params.invoiceId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find the invoice first (still using organization_id in database for now)
  const invoice = await (FlightInvoice as any).findOne({
    _id: params.invoiceId,
    organization_id: params.organizationId,
    student_id: params.studentId
  });

  if (!invoice) {
    return NextResponse.json({
      error: {
        message: 'Flight invoice not found',
        code: 'INVOICE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Only allow deletion of draft or cancelled invoices
  if (!['draft', 'cancelled'].includes(invoice.status)) {
    return NextResponse.json({
      error: {
        message: 'Only draft or cancelled invoices can be deleted',
        code: 'INVOICE_NOT_DELETABLE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // If the invoice has a linked flight charge, prevent deletion
  if (invoice.flight_charge_id) {
    return NextResponse.json({
      error: {
        message: 'Cannot delete invoice that has been converted to flight charge',
        code: 'INVOICE_HAS_CHARGE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Delete the invoice
  await (FlightInvoice as any).findByIdAndDelete(params.invoiceId);

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight invoice deleted successfully',
    auditId: securityContext.auditId,
    organizationId: params.organizationId,
    studentId: params.studentId,
    invoiceId: params.invoiceId,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight invoice deleted successfully',
    data: { invoice_id: params.invoiceId },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_INVOICE_DELETE_SECURITY_CONFIG); 