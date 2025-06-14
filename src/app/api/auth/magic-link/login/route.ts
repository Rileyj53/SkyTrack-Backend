import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { generateToken } from '@/lib/jwt';
import { generateCSRFToken } from '@/lib/csrf';

// Security configuration for magic link login endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: false, // Not required for magic link login
  requireApiKey: true, // API key still required
  requireCSRF: false, // Not required for initial login
  enableFraudDetection: true, // Critical for login attempts
  enableAdvancedAudit: true, // Track magic link usage
  dataClassification: 'confidential', // Contains authentication tokens
  rateLimiting: {
    maxRequests: 15, // Moderate rate limiting for magic link attempts
    windowMs: 60000, // 1 minute window
    slidingWindow: true
  },
  maxRequestSize: 1024 * 2 // 2KB max for login requests
};

export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Structured logging for Vercel
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Magic link login attempt initiated',
    auditId: securityContext.auditId,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'POST /api/auth/magic-link/login'
  }));

  // Check risk score early - block high-risk login attempts
  if (securityContext.riskScore > 70) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk magic link login blocked',
      auditId: securityContext.auditId,
      riskScore: securityContext.riskScore,
      fraudFlags: securityContext.fraudFlags,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Login attempt blocked due to security policy',
        code: 'HIGH_RISK_LOGIN_BLOCKED',
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

  const { token, code } = await request.json();

  // Validate input
  if (!token && !code) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Magic link login attempt with missing token and code',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Either token or code is required',
        code: 'MISSING_AUTH_DATA',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find user with valid magic token or code
  const query = {
    $or: [],
    magicTokenExpiration: { $gt: new Date() } // Only non-expired tokens
  };

  if (token) {
    query.$or.push({ magicToken: token });
  }
  if (code) {
    query.$or.push({ magicCode: code });
  }

  const user = await User.findOne(query);

  if (!user) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid or expired magic link/code attempted',
      auditId: securityContext.auditId,
      hasToken: !!token,
      hasCode: !!code,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid or expired magic link or code',
        code: 'INVALID_MAGIC_AUTH',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 401 });
  }

  // Check if user account is active
  if (!user.isActive) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Magic link login attempted for inactive user',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      isActive: user.isActive,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Account is not active',
        code: 'ACCOUNT_INACTIVE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'User authenticated using magic link/code',
    auditId: securityContext.auditId,
    userId: user._id.toString(),
    email: user.email,
    authMethod: token ? 'magic-link' : 'magic-code',
    timestamp: new Date().toISOString()
  }));

  try {
    // Clear magic link data immediately for security
    user.magicToken = null;
    user.magicTokenExpiration = null;
    user.magicCode = null;
    user.lastLogin = new Date();
    await user.save();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Magic link data cleared successfully',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      timestamp: new Date().toISOString()
    }));

    // Generate tokens
    const authToken = await generateToken(user);
    const csrfToken = generateCSRFToken();

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Magic link login successful',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    // Create response with token
    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      data: {
        token: authToken,
        csrfToken: csrfToken.token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          schoolId: user.school_id,
          mfaEnabled: user.mfaEnabled
        }
      },
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      securityContext: {
        sessionId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'AES-256'
      }
    });

    // Set HTTP-only cookie with JWT token
    response.cookies.set('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    // Set CSRF token cookie
    response.cookies.set('csrf-token', csrfToken.token, {
      httpOnly: false, // Allow JavaScript to read this cookie
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: Math.floor((csrfToken.expires - Date.now()) / 1000)
    });

    return response;

  } catch (saveError) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Failed to clear magic link data',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      error: saveError.message,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Authentication successful but session setup failed',
        code: 'SESSION_SETUP_FAILED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}, SECURITY_CONFIG); 