import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

// Security configuration for MFA status endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true, // Authentication required
  requireApiKey: true, // API key required
  requireCSRF: false, // GET request, CSRF not required
  allowedRoles: ['sys_admin', 'school_admin', 'instructor', 'student'], // All authenticated users
  enableFraudDetection: true, // Monitor MFA status checks
  enableAdvancedAudit: false, // Less critical operation, basic audit is fine
  dataClassification: 'confidential', // MFA status is sensitive information
  rateLimiting: {
    maxRequests: 50, // Moderate rate limiting for status checks
    windowMs: 60000, // 1 minute window
    slidingWindow: true
  },
  maxRequestSize: 1024 // 1KB max for status requests
};

export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Structured logging for Vercel
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'MFA status request initiated',
    auditId: securityContext.auditId,
    userId: securityContext.user?.id,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'GET /api/auth/mfa/status'
  }));

  // Check risk score - moderate threshold for status checks
  if (securityContext.riskScore > 85) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk MFA status check detected',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      riskScore: securityContext.riskScore,
      fraudFlags: securityContext.fraudFlags,
      timestamp: new Date().toISOString()
    }));
  }

  // Establish database connection with retry logic
  await connectDB();

  try {
    // Find user by ID from security context
    const userId = securityContext.user?.id;
    const user = await User.findById(userId);
    
    if (!user) {
      console.error(JSON.stringify({
        level: 'ERROR',
        message: 'User not found during MFA status check',
        auditId: securityContext.auditId,
        userId: userId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'MFA status retrieved successfully',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      mfaEnabled: user.mfaEnabled,
      mfaVerified: user.mfaVerified,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      data: {
        mfaEnabled: user.mfaEnabled,
        mfaVerified: user.mfaVerified
      },
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      securityContext: {
        sessionId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'AES-256'
      }
    });

  } catch (dbError) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Database error during MFA status check',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      error: dbError.message,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Error getting MFA status',
        code: 'DATABASE_ERROR',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}, SECURITY_CONFIG); 