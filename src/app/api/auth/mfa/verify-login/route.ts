import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { generateToken } from '@/lib/jwt';
import { generateCSRFToken } from '@/lib/csrf';

// Security configuration for MFA verify-login endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true, // Authentication required for MFA login step
  requireApiKey: true, // API key required
  requireCSRF: false, // Special case for login flow - CSRF comes after
  allowedRoles: ['sys_admin', 'school_admin', 'instructor', 'student', 'mechanic', 'member'], // All authenticated users
  enableFraudDetection: true, // Monitor MFA login attempts
  enableAdvancedAudit: true, // Track all MFA login completions
  dataClassification: 'restricted', // MFA login is highly sensitive
  rateLimiting: {
    maxRequests: 10, // Strict rate limiting for MFA login
    windowMs: 60000, // 1 minute window
    slidingWindow: true
  },
  maxRequestSize: 1024 // 1KB max for MFA login requests
};

export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Structured logging for Vercel
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'MFA login verification request initiated',
    auditId: securityContext.auditId,
    userId: securityContext.user?.id,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'POST /api/auth/mfa/verify-login'
  }));

  // Check risk score - MFA login verification is critical
  if (securityContext.riskScore > 65) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk MFA login verification blocked',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      riskScore: securityContext.riskScore,
      fraudFlags: securityContext.fraudFlags,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'MFA login verification blocked due to security policy',
        code: 'HIGH_RISK_MFA_LOGIN',
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

  // Get token from request body
  const { token } = await request.json();

  // Validate input
  if (!token) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'MFA login verification with missing token',
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
      message: 'MFA login verification with invalid token format',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      tokenLength: token.length,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  try {
    // Find user by ID from security context
    const userId = securityContext.user?.id;
    const user = await User.findById(userId).select('+mfaSecret');
    
    if (!user) {
      console.error(JSON.stringify({
        level: 'ERROR',
        message: 'User not found during MFA login verification',
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

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Verifying MFA token for login completion',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      timestamp: new Date().toISOString()
    }));

    // Verify MFA token
    const isValid = await user.verifyMFAToken(token);
    if (!isValid) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Invalid MFA token for login verification',
        auditId: securityContext.auditId,
        userId: user._id.toString(),
        email: user.email,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Invalid MFA token',
          code: 'INVALID_MFA_TOKEN',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 401 });
    }

    // Generate final tokens for complete authentication
    const jwtToken = await generateToken(user);
    const csrfToken = generateCSRFToken();

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'MFA login verification successful',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    // Set cookies and return success response
    const response = NextResponse.json({
      success: true,
      message: 'MFA verification successful',
      data: {
        userId: user._id,
        email: user.email,
        token: jwtToken,
        csrfToken: csrfToken.token
      },
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      securityContext: {
        sessionId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'AES-256'
      }
    });

    // Set JWT token cookie
    response.cookies.set('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    // Set CSRF token cookie (corrected to be readable by JavaScript)
    response.cookies.set('csrf-token', csrfToken.token, {
      httpOnly: false, // Allow JavaScript to read this cookie
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: Math.floor((csrfToken.expires - Date.now()) / 1000)
    });

    return response;

  } catch (dbError) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Database error during MFA login verification',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      error: dbError.message,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Error verifying MFA token',
        code: 'DATABASE_ERROR',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}, SECURITY_CONFIG); 