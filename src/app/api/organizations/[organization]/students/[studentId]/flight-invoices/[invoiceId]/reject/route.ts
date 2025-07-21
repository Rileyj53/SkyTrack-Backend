import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import FlightInvoice from '@/models/FlightInvoice';
import mongoose from 'mongoose';

// Security configuration for flight invoice rejection
const FLIGHT_INVOICE_REJECT_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // POST operations need CSRF
  allowedRoles: ['sys_admin', 'school_admin'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 30,
    windowMs: 60000,
    slidingWindow: true
  }
};

// POST /api/organizations/[organizationId]/students/[studentId]/flight-invoices/[invoiceId]/reject - Reject a flight invoice
export const POST = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organizationId: string, studentId: string, invoiceId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight invoice rejection request',
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

  // Find the flight invoice (still using organization_id in database for now)
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

  // Check if invoice is in a state that can be rejected
  if (!['draft', 'pending', 'sent'].includes(invoice.status)) {
    return NextResponse.json({
      error: {
        message: `Cannot reject invoice with status: ${invoice.status}`,
        code: 'INVALID_INVOICE_STATUS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Get request body for rejection reason
  const body = await request.json().catch(() => ({}));
  const rejectionReason = body.reason || '';

  // Validate rejection reason is provided
  if (!rejectionReason.trim()) {
    return NextResponse.json({
      error: {
        message: 'Rejection reason is required',
        code: 'MISSING_REJECTION_REASON',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Update invoice status to rejected
  const updateData = {
    status: 'cancelled',
    rejected_at: new Date(),
    rejected_by: securityContext.user.id,
    rejection_reason: rejectionReason.trim()
  };

  const updatedInvoice = await (FlightInvoice as any).findByIdAndUpdate(
    params.invoiceId,
    { $set: updateData },
    { new: true, runValidators: true }
  )
  .populate({
    path: 'flight_schedule_id',
    select: 'scheduled_start_time scheduled_end_time actual_duration scheduled_duration flight_type status'
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
    select: 'registration type aircraftModel hourlyRates'
  })
  .populate({
    path: 'instructor_id',
    populate: {
      path: 'user_id',
      select: 'first_name last_name email'
    }
  })
  .populate({
    path: 'rejected_by',
    select: 'first_name last_name email role'
  })
  .populate({
    path: 'created_by',
    select: 'first_name last_name email role'
  })
  .lean();

  if (!updatedInvoice) {
    return NextResponse.json({
      error: {
        message: 'Failed to reject flight invoice',
        code: 'REJECTION_FAILED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight invoice rejected successfully',
    auditId: securityContext.auditId,
    organizationId: params.organizationId,
    studentId: params.studentId,
    invoiceId: params.invoiceId,
    rejectedBy: securityContext.user.id,
    rejectionReason: rejectionReason,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight invoice rejected successfully',
    data: { 
      invoice: updatedInvoice,
      rejection: {
        rejected_at: updateData.rejected_at,
        rejected_by: securityContext.user.id,
        rejection_reason: rejectionReason
      }
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_INVOICE_REJECT_SECURITY_CONFIG); 