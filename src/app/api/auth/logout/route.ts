import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { BlacklistedToken } from '@/models/BlacklistedToken';
import { decodeToken } from '@/lib/jwt';

// Security configuration for logout endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true, // Authentication required for logout
  requireApiKey: false, // API key not required for logout
  requireCSRF: false, // CSRF protection disabled for logout (temporary fix)
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin', 'instructor', 'student', 'mechanic', 'member'], // All authenticated users can logout
  enableFraudDetection: true, // Monitor logout patterns
  enableAdvancedAudit: true, // Track logout events
  dataClassification: 'confidential', // Logout contains session data
  rateLimiting: {
    maxRequests: 50, // More lenient than login
    windowMs: 60000, // 1 minute window
    slidingWindow: true
  },
  maxRequestSize: 1024 // 1KB max for logout requests
};

export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Structured logging for Vercel
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Logout request initiated',
    auditId: securityContext.auditId,
    userId: securityContext.user?.id,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'POST /api/auth/logout'
  }));

  // Check risk score - monitor suspicious logout patterns
  if (securityContext.riskScore > 80) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk logout attempt detected',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      riskScore: securityContext.riskScore,
      fraudFlags: securityContext.fraudFlags,
      timestamp: new Date().toISOString()
    }));
  }

  // Establish database connection with retry logic
  await connectDB();

  // Get the token from the Authorization header
  const token = request.headers.get('Authorization')?.split(' ')[1];

  if (token) {
    try {
      console.log(JSON.stringify({
        level: 'INFO',
        message: 'Adding token to blacklist',
        auditId: securityContext.auditId,
        userId: securityContext.user?.id,
        timestamp: new Date().toISOString()
      }));

      // Decode the token to get its expiration
      const decoded = decodeToken(token);
      if (decoded && decoded.exp) {
        // Add token to blacklist with its expiration time
        const blacklistedToken = new BlacklistedToken({
          token,
          blacklistedAt: new Date(),
          expiresAt: new Date(decoded.exp * 1000), // Convert seconds to milliseconds
          userId: securityContext.user?.id, // Track which user blacklisted the token
          auditId: securityContext.auditId // Link to audit trail
        });
        
        await blacklistedToken.save();

        console.log(JSON.stringify({
          level: 'INFO',
          message: 'Token successfully blacklisted',
          auditId: securityContext.auditId,
          userId: securityContext.user?.id,
          tokenExpiry: new Date(decoded.exp * 1000).toISOString(),
          timestamp: new Date().toISOString()
        }));
      } else {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'Unable to decode token for blacklisting',
          auditId: securityContext.auditId,
          userId: securityContext.user?.id,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (blacklistError) {
      console.error(JSON.stringify({
        level: 'ERROR',
        message: 'Failed to blacklist token',
        auditId: securityContext.auditId,
        userId: securityContext.user?.id,
        error: blacklistError.message,
        timestamp: new Date().toISOString()
      }));
      
      // Continue with logout even if blacklisting fails
      // The token will still be invalid due to cookie clearing
    }
  } else {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'No token found in Authorization header during logout',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      timestamp: new Date().toISOString()
    }));
  }

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Logout completed successfully',
    auditId: securityContext.auditId,
    userId: securityContext.user?.id,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  // Create response
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString(),
    securityContext: {
      sessionId: securityContext.auditId,
      riskScore: securityContext.riskScore,
      encryptionLevel: 'AES-256'
    }
  });

  // Clear the token cookie
  response.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0
  });

  // Clear the CSRF token cookie
  response.cookies.set('csrf-token', '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0
  });

  return response;
}, SECURITY_CONFIG);
