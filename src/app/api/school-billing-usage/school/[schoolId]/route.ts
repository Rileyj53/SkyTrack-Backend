import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { SchoolBillingUsage } from '../../../../../models/SchoolBillingUsage';
import { connectDB } from '../../../../../lib/db';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Security configuration for billing usage endpoints - requires authentication and school admin role
const BILLING_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  allowedRoles: ['school_admin', 'sys_admin', 'club_admin'],
  requireOrganizationAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

// GET /api/school-billing-usage/school/[organizationId] - Get billing usage for specific organization
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { schoolId: string }, securityContext: any }
) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization-specific billing usage records requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      requestedOrganizationId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    const { schoolId: organizationId } = params; // Note: keeping param name for backward compatibility
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '12'); // Default to 12 months
    
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid organization ID',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Role-based access control - school_admin can only see their own organization's data
    if (securityContext.user?.role === 'school_admin') {
      if (securityContext.user?.organization_id !== organizationId) {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'School admin attempted to access different organization billing data',
          auditId: securityContext.auditId,
          userId: securityContext.user?.userId,
          userOrganizationId: securityContext.user?.organization_id,
          requestedOrganizationId: organizationId,
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

    const records = await SchoolBillingUsage
      .find({ organization_id: organizationId })
      .sort({ month: -1 })
      .limit(limit);

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization billing usage records retrieved',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      organizationId,
      recordsCount: records.length,
      limit,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Organization billing usage records retrieved successfully',
      data: records,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      pagination: {
        limit,
        count: records.length,
        organizationId
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error fetching organization billing usage',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      organizationId: params.schoolId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, BILLING_CONFIG); 