import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Debug endpoint configuration for POST (requires CSRF)
const POST_DEBUG_CONFIG: SecurityConfig = {
  requireApiKey: true,
  requireCSRF: true,
  enableFraudDetection: true,
  dataClassification: 'public',
  rateLimiting: { maxRequests: 50, windowMs: 60000 }
};

// Debug endpoint configuration for GET (no CSRF required)
const GET_DEBUG_CONFIG: SecurityConfig = {
  requireApiKey: true,
  enableFraudDetection: true,
  dataClassification: 'public',
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

export const POST = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'CSRF test POST endpoint accessed',
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }));

  // Get the CSRF token from the header
  const csrfToken = request.headers.get('X-CSRF-Token');
  
  // Get the stored CSRF token from the cookie
  const storedToken = request.cookies.get('csrf-token')?.value;
  
  return NextResponse.json({
    success: true,
    message: 'CSRF protection debug endpoint',
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString(),
    csrfToken: csrfToken ? csrfToken.substring(0, 10) + '...' : 'missing',
    storedToken: storedToken ? storedToken.substring(0, 10) + '...' : 'missing',
    debugInfo: {
      hasCSRFHeader: !!csrfToken,
      hasCSRFCookie: !!storedToken,
      tokensMatch: csrfToken === storedToken,
      headerKeys: Array.from(request.headers.keys()),
      cookieKeys: request.cookies.getAll().map(cookie => cookie.name),
      csrfValidationPassed: true, // If we reach here, CSRF validation passed
      securityContext: {
        riskScore: securityContext.riskScore,
        sessionId: securityContext.sessionId
      }
    }
  });
}, POST_DEBUG_CONFIG);

export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'CSRF test GET endpoint accessed',
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'CSRF debug endpoint (GET method - no CSRF validation required)',
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString(),
    availableCookies: request.cookies.getAll().map(cookie => ({
      name: cookie.name,
      valuePreview: cookie.value.substring(0, 10) + '...'
    })),
    debugInfo: {
      method: 'GET',
      csrfRequired: false,
      note: 'Use POST method to test CSRF validation',
      securityContext: {
        riskScore: securityContext.riskScore,
        sessionId: securityContext.sessionId
      }
    }
  });
}, GET_DEBUG_CONFIG); 