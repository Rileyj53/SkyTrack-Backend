import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { SchoolBillingUsage } from '../../../../models/SchoolBillingUsage';
import { connectDB } from '../../../../lib/db';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Security configuration for billing usage endpoints - requires authentication and school admin role
const BILLING_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  allowedRoles: ['school_admin', 'sys_admin', 'club_admin'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

// GET /api/school-billing-usage/[id] - Get specific billing usage record
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { id: string }, securityContext: any }
) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization billing usage record requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      recordId: params.id,
      timestamp: new Date().toISOString()
    }));
    
    const { id } = params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid billing usage ID',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const record = await SchoolBillingUsage
      .findById(id)
      .populate('organization_id', 'name');

    if (!record) {
      return NextResponse.json({
        success: false,
        error: 'Billing usage record not found',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Role-based access control - school_admin can only see their own organization's data
    if (securityContext.user?.role === 'school_admin') {
      if (securityContext.user?.organization_id !== record.organization_id.toString()) {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'School admin attempted to access different organization billing record',
          auditId: securityContext.auditId,
          userId: securityContext.user?.userId,
          userOrganizationId: securityContext.user?.organization_id,
          recordOrganizationId: record.organization_id.toString(),
          timestamp: new Date().toISOString()
        }));

        return NextResponse.json({
          success: false,
          error: 'Access denied: You can only view billing data for your own organization',
          auditId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }, { status: 403 });
      }
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization billing usage record retrieved',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      recordId: record._id,
      organizationId: record.organization_id,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Billing usage record retrieved successfully',
      data: record,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error fetching billing usage record',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      recordId: params.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, BILLING_CONFIG);

// PUT /api/school-billing-usage/[id] - Update specific billing usage record
export const PUT = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { id: string }, securityContext: any }
) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization billing usage record update requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      recordId: params.id,
      timestamp: new Date().toISOString()
    }));
    
    const { id } = params;
    const updateData = await request.json();

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

    // Role-based access control - school_admin can only update their own organization's data
    if (securityContext.user?.role === 'school_admin') {
      if (securityContext.user?.organization_id !== existingRecord.organization_id.toString()) {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'School admin attempted to update different organization billing record',
          auditId: securityContext.auditId,
          userId: securityContext.user?.userId,
          userOrganizationId: securityContext.user?.organization_id,
          recordOrganizationId: existingRecord.organization_id.toString(),
          timestamp: new Date().toISOString()
        }));

        return NextResponse.json({
          success: false,
          error: 'Access denied: You can only update billing data for your own organization',
          auditId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }, { status: 403 });
      }
    }

    // Don't allow updating organization_id or month
    delete updateData.organization_id;
    delete updateData.month;

    const record = await SchoolBillingUsage.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('organization_id', 'name');

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization billing usage record updated',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      recordId: record._id,
      organizationId: record.organization_id,
      updatedFields: Object.keys(updateData),
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Billing usage record updated successfully',
      data: record,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error updating billing usage record',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      recordId: params.id,
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
    } else {
      throw error;
    }
  }
}, BILLING_CONFIG);

// DELETE /api/school-billing-usage/[id] - Delete billing usage record
export const DELETE = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { id: string }, securityContext: any }
) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization billing usage record deletion requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      recordId: params.id,
      timestamp: new Date().toISOString()
    }));
    
    const { id } = params;

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

    // Role-based access control - school_admin can only delete their own organization's data
    if (securityContext.user?.role === 'school_admin') {
      if (securityContext.user?.organization_id !== existingRecord.organization_id.toString()) {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'School admin attempted to delete different organization billing record',
          auditId: securityContext.auditId,
          userId: securityContext.user?.userId,
          userOrganizationId: securityContext.user?.organization_id,
          recordOrganizationId: existingRecord.organization_id.toString(),
          timestamp: new Date().toISOString()
        }));

        return NextResponse.json({
          success: false,
          error: 'Access denied: You can only delete billing data for your own organization',
          auditId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }, { status: 403 });
      }
    }

    const record = await SchoolBillingUsage.findByIdAndDelete(id);

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization billing usage record deleted',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      recordId: id,
      organizationId: existingRecord.organization_id,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Billing usage record deleted successfully',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error deleting billing usage record',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      recordId: params.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, BILLING_CONFIG); 