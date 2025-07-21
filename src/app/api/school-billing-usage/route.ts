import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { SchoolBillingUsage } from '../../../models/SchoolBillingUsage';
import { connectDB } from '../../../lib/db';
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
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

// GET /api/school-billing-usage - Get all billing usage records (with optional filters)
export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization billing usage records requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      timestamp: new Date().toISOString()
    }));
    
    const { searchParams } = new URL(request.url);
    const organization_id = searchParams.get('organization_id');
    const month = searchParams.get('month');
    const billed = searchParams.get('billed');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    
    // Build filter object
    const filter: any = {};
    if (organization_id) filter.organization_id = organization_id;
    if (month) filter.month = month;
    if (billed !== null) filter.billed = billed === 'true';

    // Role-based access control - school_admin can only see their own organization's data
    if (securityContext.user?.role === 'school_admin' && securityContext.user?.organization_id) {
      filter.organization_id = securityContext.user.organization_id;
    }

    const records = await SchoolBillingUsage
      .find(filter)
      .populate('organization_id', 'name')
      .sort({ month: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip);

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization billing usage records retrieved',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      recordsCount: records.length,
      filters: filter,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Billing usage records retrieved successfully',
      data: records,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      pagination: {
        limit,
        skip,
        count: records.length
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error fetching billing usage records',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, BILLING_CONFIG);

// POST /api/school-billing-usage - Create or update billing usage record
export const POST = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization billing usage record creation/update requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      timestamp: new Date().toISOString()
    }));
    
    const body = await request.json();
    const {
      organization_id,
      month,
      total_transactions,
      stripe_transactions,
      billed,
      stripe_invoice_id
    } = body;

    // Validate required fields
    if (!organization_id || !month || total_transactions === undefined || stripe_transactions === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: organization_id, month, total_transactions, stripe_transactions',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({
        success: false,
        error: 'Month must be in YYYY-MM format',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(organization_id)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid organization ID',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Role-based access control - school_admin can only create/update their own organization's data
    if (securityContext.user?.role === 'school_admin') {
      if (securityContext.user?.organization_id !== organization_id) {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'School admin attempted to access different organization billing data',
          auditId: securityContext.auditId,
          userId: securityContext.user?.userId,
          userOrganizationId: securityContext.user?.organization_id,
          requestedOrganizationId: organization_id,
          timestamp: new Date().toISOString()
        }));

        return NextResponse.json({
          success: false,
          error: 'Access denied: You can only manage billing data for your own organization',
          auditId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }, { status: 403 });
      }
    }

    // Try to update existing record or create new one (upsert)
    const record = await SchoolBillingUsage.findOneAndUpdate(
      { organization_id, month },
      {
        organization_id,
        month,
        total_transactions,
        stripe_transactions,
        billed: billed || false,
        stripe_invoice_id: stripe_invoice_id || null,
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    ).populate('organization_id', 'name');

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization billing usage record created/updated',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      recordId: record._id,
      organizationId: organization_id,
      month,
      totalTransactions: total_transactions,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Billing usage record created/updated successfully',
      data: record,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error creating/updating billing usage record',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({
        success: false,
        error: error.message,
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    } else if (error.code === 11000) {
      return NextResponse.json({
        success: false,
        error: 'Billing usage record already exists for this organization and month',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 409 });
    } else {
      throw error;
    }
  }
}, BILLING_CONFIG); 