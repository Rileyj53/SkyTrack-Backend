import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { revokeApiKey } from '@/lib/apiKeys';

// Maximum security configuration for API key revocation
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  requireHttpsOnly: true,
  allowedRoles: ['sys_admin'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'restricted',
  rateLimiting: {
    maxRequests: 10,
    windowMs: 60000,
    slidingWindow: true
  },
  sessionTimeout: 15
};

export const DELETE = secureApiRoute(async (request, { params, securityContext }) => {
  try {
    // Establish database connection with automatic retry logic
    await connectDB();
    
    // Get the API key ID from the URL params
    const { apiKeyId } = params;
    
    // Validate the API key ID parameter
    if (!apiKeyId || typeof apiKeyId !== 'string') {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Invalid API key ID provided',
        auditId: securityContext.auditId,
        userId: securityContext.user?.userId,
        providedId: apiKeyId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Invalid API key ID provided',
          code: 'INVALID_API_KEY_ID',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
    
    // Structured logging for Vercel
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Attempting to revoke API key',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      apiKeyId: apiKeyId,
      riskScore: securityContext.riskScore,
      timestamp: new Date().toISOString(),
      endpoint: `/api/api-keys/${apiKeyId}`
    }));

    // Revoke the API key using the authenticated user's ID
    const success = await revokeApiKey(securityContext.user.userId, apiKeyId);

    if (!success) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'API key not found or already revoked',
        auditId: securityContext.auditId,
        userId: securityContext.user?.userId,
        apiKeyId: apiKeyId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'API key not found or already revoked',
          code: 'API_KEY_NOT_FOUND',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'API key revoked successfully',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      apiKeyId: apiKeyId,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
      data: {
        apiKeyId: apiKeyId,
        revokedAt: new Date().toISOString()
      },
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      securityContext: {
        sessionId: securityContext.sessionId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'AES-256'
      }
    });

  } catch (error) {
    // Enhanced error logging
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Failed to revoke API key',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      apiKeyId: params?.apiKeyId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    
    // Let the global errorHandler process the error
    throw error;
  }
}, SECURITY_CONFIG); 