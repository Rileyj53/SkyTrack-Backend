import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Debug endpoint configuration - requires sys_admin role
const DEBUG_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  allowedRoles: ['sys_admin'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: { maxRequests: 30, windowMs: 60000 }
};

export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'System admin protected test endpoint accessed',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      timestamp: new Date().toISOString()
    }));

    // Return success response with debug information
    return NextResponse.json({
      success: true,
      message: 'System admin protected endpoint accessed successfully',
      auditId: securityContext.auditId,
      data: {
        userId: securityContext.user?.userId,
        userRole: securityContext.user?.role,
        apiKeyLabel: securityContext.apiKey?.label || 'Unknown'
      },
      timestamp: new Date().toISOString(),
      debugInfo: {
        tokenUserId: securityContext.user?.userId,
        tokenRole: securityContext.user?.role,
        apiKeyUsed: !!securityContext.apiKey,
        requestMethod: request.method,
        securityContext: {
          riskScore: securityContext.riskScore,
          sessionId: securityContext.sessionId,
          geoLocation: securityContext.geoLocation,
          fraudFlags: securityContext.fraudFlags
        }
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Protected test endpoint error',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, DEBUG_CONFIG); 