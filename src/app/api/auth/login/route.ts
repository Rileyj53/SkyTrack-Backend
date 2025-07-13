import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { comparePasswords } from '@/lib/auth';
import { generateToken } from '@/lib/jwt';
import { generateCSRFToken } from '@/lib/csrf';
import { User } from '@/models/User';

// Security configuration for login endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: false, // Not required for login
  requireApiKey: false, // API not required
  requireCSRF: false, // Not required for initial login
  enableFraudDetection: true, // Critical for login attempts
  enableAdvancedAudit: true, // Track login attempts
  dataClassification: 'confidential', // Login contains sensitive data
  rateLimiting: {
    maxRequests: 10, // Strict rate limiting to prevent brute force
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
    message: 'Login attempt initiated',
    auditId: securityContext.auditId,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'POST /api/auth/login'
  }));

  // Check risk score early - block high-risk login attempts
  if (securityContext.riskScore > 70) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk login attempt blocked',
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

  const { email, password, token } = await request.json();

  // Validate input
  if (!email || !password) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Login attempt with missing credentials',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find user by email
  const user = await User.findOne({ email }).select('+password +mfaSecret +mfaBackupCodes +mfaEnabled');
  if (!user) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Login attempt with invalid email',
      auditId: securityContext.auditId,
      email: email, // Safe to log email for security monitoring
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 401 });
  }

  // Verify password
  const isValidPassword = await comparePasswords(password, user.password);
  if (!isValidPassword) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Login attempt with invalid password',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: email,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 401 });
  }

  // Check if MFA is required - MFA should be required on EVERY login when enabled
  if (user.mfaEnabled) {
    // If no token provided, return MFA required response
    if (!token) {
      console.log(JSON.stringify({
        level: 'INFO',
        message: 'MFA verification required for user',
        auditId: securityContext.auditId,
        userId: user._id.toString(),
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        message: 'MFA verification required',
        requiresMFA: true,
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 428 }); // 428 Precondition Required
    }

    // Verify MFA token
    if (!user.mfaSecret) {
      console.error(JSON.stringify({
        level: 'ERROR',
        message: 'MFA enabled but secret not found',
        auditId: securityContext.auditId,
        userId: user._id.toString(),
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'MFA configuration error',
          code: 'MFA_CONFIG_ERROR',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 500 });
    }

    // Verify the MFA token
    const isValidToken = await user.verifyMFAToken(token);
    if (!isValidToken) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Invalid MFA token provided',
        auditId: securityContext.auditId,
        userId: user._id.toString(),
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
  }

  // Generate JWT token
  const jwtToken = await generateToken(user);

  // Generate new CSRF token
  const csrfToken = generateCSRFToken();
  
  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Login successful',
    auditId: securityContext.auditId,
    userId: user._id.toString(),
    mfaUsed: user.mfaEnabled,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  // Create response
  const response = NextResponse.json({
    success: true,
    message: 'Login successful',
    data: {
      token: jwtToken,
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

  // Set JWT token cookie
  response.cookies.set('token', jwtToken, {
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
}, SECURITY_CONFIG);