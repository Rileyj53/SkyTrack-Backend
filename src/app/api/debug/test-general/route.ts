import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Debug endpoint configuration - public test endpoint
const DEBUG_CONFIG: SecurityConfig = {
  requireApiKey: true,
  enableFraudDetection: true,
  dataClassification: 'public',
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'General test GET endpoint accessed',
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }));

  // Get request ID from headers (added by requestLogger middleware)
  const requestId = request.headers.get('X-Request-ID');
  
  return NextResponse.json({
    success: true,
    message: 'General test API endpoint',
    auditId: securityContext.auditId,
    requestId,
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers),
    debugInfo: {
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      acceptLanguage: request.headers.get('accept-language'),
      securityContext: {
        riskScore: securityContext.riskScore,
        sessionId: securityContext.sessionId,
        geoLocation: securityContext.geoLocation
      }
    }
  });
}, DEBUG_CONFIG);

export const POST = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'General test POST endpoint accessed',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    }));

    const body = await request.json();
    
    return NextResponse.json({
      success: true,
      message: 'General test POST endpoint',
      auditId: securityContext.auditId,
      receivedData: body,
      timestamp: new Date().toISOString(),
      debugInfo: {
        bodySize: JSON.stringify(body).length,
        contentType: request.headers.get('content-type'),
        method: request.method,
        securityContext: {
          riskScore: securityContext.riskScore,
          sessionId: securityContext.sessionId,
          fraudFlags: securityContext.fraudFlags
        }
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Invalid JSON payload in general test',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: false,
      error: 'Invalid JSON payload',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      debugInfo: {
        errorMessage: error.message,
        contentType: request.headers.get('content-type')
      }
    }, { status: 400 });
  }
}, DEBUG_CONFIG); 