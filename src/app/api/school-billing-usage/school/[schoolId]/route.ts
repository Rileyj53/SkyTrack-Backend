import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { SchoolBillingUsage } from '../../../../../models/SchoolBillingUsage';
import { connectDB } from '../../../../../lib/db';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Security configuration for billing usage endpoints - requires authentication and school admin role
const BILLING_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  allowedRoles: ['school_admin', 'sys_admin'],
  requireSchoolAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

// GET /api/school-billing-usage/school/[schoolId] - Get billing usage for specific school
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { schoolId: string }, securityContext: any }
) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'School-specific billing usage records requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      requestedSchoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    const { schoolId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '12'); // Default to 12 months
    
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid school ID',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Role-based access control - school_admin can only see their own school's data
    if (securityContext.user?.role === 'school_admin') {
      if (securityContext.user?.school_id !== schoolId) {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'School admin attempted to access different school billing data',
          auditId: securityContext.auditId,
          userId: securityContext.user?.userId,
          userSchoolId: securityContext.user?.school_id,
          requestedSchoolId: schoolId,
          timestamp: new Date().toISOString()
        }));

        return NextResponse.json({
          success: false,
          error: 'Access denied: You can only view billing data for your own school',
          auditId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }, { status: 403 });
      }
    }

    const records = await SchoolBillingUsage
      .find({ school_id: schoolId })
      .sort({ month: -1 })
      .limit(limit);

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'School billing usage records retrieved',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      schoolId,
      recordsCount: records.length,
      limit,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'School billing usage records retrieved successfully',
      data: records,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      pagination: {
        limit,
        count: records.length,
        schoolId
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error fetching school billing usage',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      schoolId: params.schoolId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, BILLING_CONFIG); 