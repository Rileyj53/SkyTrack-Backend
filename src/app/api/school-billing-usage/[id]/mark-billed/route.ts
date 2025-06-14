import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { SchoolBillingUsage } from '../../../../../models/SchoolBillingUsage';
import { connectDB } from '../../../../../lib/db';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Security configuration for billing usage endpoints - requires authentication and school admin role
const BILLING_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  allowedRoles: ['school_admin', 'sys_admin'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: { maxRequests: 50, windowMs: 60000 }
};

// PATCH /api/school-billing-usage/[id]/mark-billed - Mark record as billed
export const PATCH = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { id: string }, securityContext: any }
) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Mark billing usage as billed requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      recordId: params.id,
      timestamp: new Date().toISOString()
    }));
    
    const { id } = params;
    const body = await request.json();
    const { stripe_invoice_id } = body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid billing usage ID',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // First, get the existing record to check permissions
    const existingRecord = await SchoolBillingUsage.findById(id);
    if (!existingRecord) {
      return NextResponse.json({
        success: false,
        error: 'Billing usage record not found',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Role-based access control - school_admin can only mark their own school's data as billed
    if (securityContext.user?.role === 'school_admin') {
      if (securityContext.user?.school_id !== existingRecord.school_id.toString()) {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'School admin attempted to mark different school billing record as billed',
          auditId: securityContext.auditId,
          userId: securityContext.user?.userId,
          userSchoolId: securityContext.user?.school_id,
          recordSchoolId: existingRecord.school_id.toString(),
          timestamp: new Date().toISOString()
        }));

        return NextResponse.json({
          success: false,
          error: 'Access denied: You can only mark billing data for your own school as billed',
          auditId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }, { status: 403 });
      }
    }

    const record = await SchoolBillingUsage.findByIdAndUpdate(
      id,
      { 
        billed: true,
        stripe_invoice_id: stripe_invoice_id || null,
        last_updated: new Date()
      },
      { new: true, runValidators: true }
    ).populate('school_id', 'name');

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'School billing usage record marked as billed',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      recordId: record._id,
      schoolId: record.school_id,
      stripeInvoiceId: stripe_invoice_id,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Billing usage record marked as billed successfully',
      data: record,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error marking billing usage as billed',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      recordId: params.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, BILLING_CONFIG); 