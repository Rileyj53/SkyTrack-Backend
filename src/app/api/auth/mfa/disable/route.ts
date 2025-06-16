import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

// Security configuration for MFA disable endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true, // Authentication required
  requireApiKey: true, // API key required
  requireCSRF: true, // CSRF protection for destructive action
  allowedRoles: ['sys_admin', 'school_admin', 'instructor', 'student'], // All authenticated users
  requireSchoolAccess: false, // User can disable their own MFA
  enableFraudDetection: true, // Monitor MFA disable attempts
  enableAdvancedAudit: true, // Track all MFA security changes
  dataClassification: 'restricted', // MFA changes are highly sensitive
  rateLimiting: {
    maxRequests: 5, // Very strict rate limiting for security changes
    windowMs: 60000, // 1 minute window
    slidingWindow: true
  },
  maxRequestSize: 1024 // 1KB max for MFA requests
};

export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Structured logging for Vercel
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'MFA disable request initiated',
    auditId: securityContext.auditId,
    userId: securityContext.user?.id,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'POST /api/auth/mfa/disable'
  }));

  // Check risk score - MFA changes are critical security operations
  if (securityContext.riskScore > 60) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk MFA disable attempt blocked',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      riskScore: securityContext.riskScore,
      fraudFlags: securityContext.fraudFlags,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'MFA disable blocked due to security policy',
        code: 'HIGH_RISK_MFA_DISABLE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      },
      securityContext: {
        riskScore: securityContext.riskScore,
        fraudFlags: securityContext.fraudFlags
      }
    }, { status: 403 });
  }

  // Establish database connection with retry logic
  await connectDB();

  const { token } = await request.json();

  // Validate input
  if (!token) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'MFA disable attempt with missing token',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Token is required',
        code: 'MISSING_TOKEN',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate token format
  if (!/^\d{6}$/.test(token)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'MFA disable attempt with invalid token format',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      tokenLength: token.length,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Token must be a 6-digit code',
        code: 'INVALID_TOKEN_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  try {
    // Find user by ID from security context
    const userId = securityContext.user?.id;
    const user = await User.findById(userId).select('+mfaSecret +mfaBackupCodes');
    
    if (!user) {
      console.error(JSON.stringify({
        level: 'ERROR',
        message: 'User not found during MFA disable',
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

    // Check if MFA is enabled
    if (!user.mfaEnabled) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Attempt to disable MFA when not enabled',
        auditId: securityContext.auditId,
        userId: user._id.toString(),
        email: user.email,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'MFA is not enabled',
          code: 'MFA_NOT_ENABLED',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Verifying MFA token for disable',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      timestamp: new Date().toISOString()
    }));

    // Verify the token
    const isValid = await user.verifyMFAToken(token);
    
    if (!isValid) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Invalid MFA token for disable attempt',
        auditId: securityContext.auditId,
        userId: user._id.toString(),
        email: user.email,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Invalid verification code',
          code: 'INVALID_MFA_TOKEN',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 401 });
    }

    // Disable MFA
    await user.disableMFA();

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'MFA disabled successfully',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'MFA disabled successfully',
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
      message: 'Database error during MFA disable',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      error: dbError.message,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Error disabling MFA',
        code: 'DATABASE_ERROR',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}, SECURITY_CONFIG); 