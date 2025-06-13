import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { listApiKeys } from '@/lib/apiKeys';

// Maximum security configuration for API key listing
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
    maxRequests: 20,
    windowMs: 60000,
    slidingWindow: true
  },
  sessionTimeout: 15
};

export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  try {
    // Establish database connection with automatic retry logic
    await connectDB();
    
    // Structured logging for Vercel
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Fetching user-specific API keys list',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      riskScore: securityContext.riskScore,
      timestamp: new Date().toISOString(),
      endpoint: '/api/api-keys/keys'
    }));

    // Get the API keys for the authenticated user using the library function
    const apiKeys = await listApiKeys(securityContext.user.userId);

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Successfully retrieved user API keys list',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      count: apiKeys.length,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'API keys retrieved successfully',
      data: apiKeys,
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
      message: 'Failed to retrieve user API keys',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    
    // Let the global errorHandler process the error
    throw error;
  }
}, SECURITY_CONFIG); 