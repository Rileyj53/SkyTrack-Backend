import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { generateCSRFToken } from '@/lib/csrf';
import { sanitizeData } from '@/middleware/security';

// Security configuration for CSRF token generation
const CSRF_TOKEN_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: false, // No authentication required - public service
  requireApiKey: true, // API key required to prevent abuse
  requireCSRF: false, // Can't require CSRF for CSRF token generation!
  enableFraudDetection: true, // Monitor for suspicious token requests
  enableAdvancedAudit: true, // Enhanced logging for security monitoring
  dataClassification: 'public', // CSRF tokens are not sensitive data
  rateLimiting: {
    maxRequests: 100, // Allow reasonable number of token requests
    windowMs: 60000, // 1 minute window
    slidingWindow: true
  },
  maxRequestSize: 1024, // Small request size - just headers
  sessionTimeout: 60 // 1 hour session for token requests
};

// GET /api/auth/csrf-token - Generate and return CSRF token
export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  try {
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'CSRF token generation request received',
      auditId: securityContext.auditId,
      riskScore: securityContext.riskScore,
      timestamp: new Date().toISOString(),
      endpoint: '/api/auth/csrf-token'
    }));

    // Check risk score for suspicious activity
    if (securityContext.riskScore > 80) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'High risk CSRF token request blocked',
        auditId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        fraudFlags: securityContext.fraudFlags,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        error: {
          message: 'Token request blocked due to security policy',
          code: 'HIGH_RISK_TOKEN_REQUEST',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        },
        securityContext: {
          riskScore: securityContext.riskScore,
          fraudFlags: securityContext.fraudFlags
        }
      }, { status: 403 });
    }

    // Generate a new CSRF token with expiration
    const csrfToken = generateCSRFToken();
    
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'CSRF token generated successfully',
      auditId: securityContext.auditId,
      tokenExpires: new Date(csrfToken.expires).toISOString(),
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }));

    // Create response with sanitized token data
    const responseData = {
      success: true,
      message: 'CSRF token generated successfully',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      data: sanitizeData({
        token: csrfToken.token,
        expires: csrfToken.expires,
        maxAge: Math.floor((csrfToken.expires - Date.now()) / 1000)
      }, 'public'),
      securityContext: {
        sessionId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'None' // CSRF tokens are not encrypted
      }
    };

    const response = NextResponse.json(responseData, { status: 200 });

    // Set the token in a cookie
    response.cookies.set('csrf-token', csrfToken.token, {
      httpOnly: false, // Allow JavaScript to read this cookie
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: Math.floor((csrfToken.expires - Date.now()) / 1000)
    });

    return response;

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'CSRF token generation failed',
      auditId: securityContext.auditId,
      error: error.message,
      stack: process?.env?.NODE_ENV === 'development' ? error.stack : undefined,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }));

    throw error; // Let the global errorHandler process it
  }
}, CSRF_TOKEN_SECURITY_CONFIG); 