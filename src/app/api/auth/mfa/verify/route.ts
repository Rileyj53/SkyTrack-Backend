import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

// Security configuration for MFA verify endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true, // Authentication required
  requireApiKey: true, // API key required
  requireCSRF: true, // CSRF protection for verification
  allowedRoles: ['sys_admin', 'school_admin', 'instructor', 'student'], // All authenticated users
  requireSchoolAccess: false, // User can verify their own MFA
  enableFraudDetection: true, // Monitor MFA verification attempts
  enableAdvancedAudit: true, // Track all MFA verifications
  dataClassification: 'restricted', // MFA verification is highly sensitive
  rateLimiting: {
    maxRequests: 10, // Strict rate limiting for verification attempts
    windowMs: 60000, // 1 minute window
    slidingWindow: true
  },
  maxRequestSize: 1024 // 1KB max for verification requests
};

export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Structured logging for Vercel
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'MFA verification request initiated',
    auditId: securityContext.auditId,
    userId: securityContext.user?.id,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'POST /api/auth/mfa/verify'
  }));

  // Check risk score - MFA verification is critical
  if (securityContext.riskScore > 65) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk MFA verification attempt blocked',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      riskScore: securityContext.riskScore,
      fraudFlags: securityContext.fraudFlags,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'MFA verification blocked due to security policy',
        code: 'HIGH_RISK_MFA_VERIFY',
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
      message: 'MFA verification attempt with missing token',
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
      message: 'MFA verification attempt with invalid token format',
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

  // Check if token is "[REDACTED]" and return a helpful error
  if (token === '[REDACTED]') {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'MFA verification with placeholder token',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid token format. The token appears to be a placeholder "[REDACTED]" instead of the actual 6-digit code. Please provide the actual 6-digit code from your authenticator app.',
        code: 'PLACEHOLDER_TOKEN',
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
        message: 'User not found during MFA verification',
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

    // Check if MFA is enabled but not verified
    if (!user.mfaEnabled || user.mfaVerified) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Invalid MFA state for verification',
        auditId: securityContext.auditId,
        userId: user._id.toString(),
        mfaEnabled: user.mfaEnabled,
        mfaVerified: user.mfaVerified,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Invalid MFA state. Please setup MFA first.',
          code: 'INVALID_MFA_STATE',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Log the verification attempt (with redacted sensitive info)
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Verifying MFA token',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      tokenLength: token.length,
      mfaSecretExists: !!user.mfaSecret,
      mfaSecretLength: user.mfaSecret ? user.mfaSecret.length : 0,
      timestamp: new Date().toISOString()
    }));

    // Verify the token
    const isValid = await user.verifyMFAToken(token);
    
    if (!isValid) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Invalid MFA token for verification',
        auditId: securityContext.auditId,
        userId: user._id.toString(),
        tokenLength: token.length,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Invalid verification code. Please try again with a fresh code from your authenticator app.',
          code: 'INVALID_MFA_TOKEN',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 401 });
    }

    // Mark MFA as verified
    user.mfaVerified = true;
    await user.save();

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'MFA verification successful',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'MFA verification successful',
      data: {
        mfaEnabled: true,
        mfaVerified: true
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
      message: 'Database error during MFA verification',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      error: dbError.message,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Error verifying MFA',
        code: 'DATABASE_ERROR',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}, SECURITY_CONFIG); 