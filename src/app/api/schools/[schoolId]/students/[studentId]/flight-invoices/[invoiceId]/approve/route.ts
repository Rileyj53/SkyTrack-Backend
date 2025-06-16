import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import FlightInvoice from '@/models/FlightInvoice';
import mongoose from 'mongoose';

// Security configuration for flight invoice approval
const FLIGHT_INVOICE_APPROVE_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // POST operations need CSRF
  allowedRoles: ['sys_admin', 'school_admin'],
  requireSchoolAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 30,
    windowMs: 60000,
    slidingWindow: true
  }
};

// POST /api/schools/[schoolId]/students/[studentId]/flight-invoices/[invoiceId]/approve - Approve a flight invoice
export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight invoice approval request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    invoiceId: params.invoiceId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.schoolId) || 
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

  // Find the flight invoice
  const invoice = await (FlightInvoice as any).findOne({
    _id: params.invoiceId,
    school_id: params.schoolId,
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

  // Check if invoice is in a state that can be approved
  if (!['draft', 'pending'].includes(invoice.status)) {
    return NextResponse.json({
      error: {
        message: `Cannot approve invoice with status: ${invoice.status}`,
        code: 'INVALID_INVOICE_STATUS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Get request body for approval notes
  const body = await request.json().catch(() => ({}));
  const approvalNotes = body.notes || '';

  // Update invoice status to approved/sent
  const updateData = {
    status: 'sent',
    approved_at: new Date(),
    approved_by: securityContext.user.id,
    approval_notes: approvalNotes,
    sent_at: new Date() // Mark as sent when approved
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
    path: 'approved_by',
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
        message: 'Failed to approve flight invoice',
        code: 'APPROVAL_FAILED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight invoice approved successfully',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    invoiceId: params.invoiceId,
    approvedBy: securityContext.user.id,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight invoice approved successfully',
    data: { 
      invoice: updatedInvoice,
      approval: {
        approved_at: updateData.approved_at,
        approved_by: securityContext.user.id,
        approval_notes: approvalNotes
      }
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_INVOICE_APPROVE_SECURITY_CONFIG); 