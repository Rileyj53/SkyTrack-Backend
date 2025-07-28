import { NextRequest, NextResponse } from 'next/server';
import { SchoolBillingUsage } from '../../../../models/SchoolBillingUsage';
import { connectDB } from '../../../../lib/db';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Security configuration for billing usage endpoints - requires authentication and school admin role
const BILLING_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  allowedRoles: ['school_admin', 'sys_admin', 'club_admin'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

// GET /api/school-billing-usage/unbilled - Get all unbilled records
export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Unbilled billing usage records requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      timestamp: new Date().toISOString()
    }));

    // Build filter for unbilled records
    const filter: any = { billed: false };

    // Role-based access control - school_admin can only see their own organization's data
    if (securityContext.user?.role === 'school_admin' && securityContext.user?.organization_id) {
      filter.organization_id = securityContext.user.organization_id;
    }
    
    const records = await SchoolBillingUsage
      .find(filter)
      .populate('organization_id', 'name')
      .sort({ month: -1, createdAt: -1 });

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Unbilled billing usage records retrieved',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      recordsCount: records.length,
      userRole: securityContext.user?.role,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Unbilled billing usage records retrieved successfully',
      data: records,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      summary: {
        totalUnbilledRecords: records.length,
        accessLevel: securityContext.user?.role === 'school_admin' ? 'organization-specific' : 'all-organizations'
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error fetching unbilled records',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, BILLING_CONFIG); 