import { NextRequest, NextResponse } from 'next/server';
import { Errors } from '@/lib/errors';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Debug endpoint configuration - minimal security for debugging
const DEBUG_CONFIG: SecurityConfig = {
  requireApiKey: true,
  enableFraudDetection: false,
  dataClassification: 'public',
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

// Debug endpoint for testing middleware functionality
export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  // Get all request headers
  const headers = Array.from(request.headers.entries());
  
  // Example of throwing a custom error for testing
  if (request.nextUrl.searchParams.has('error')) {
    throw Errors.BadRequest('This is a test error for middleware debugging', { param: 'error' });
  }
  
  // Create a response with the headers and debug info including security context
  const response = NextResponse.json({
    message: 'Debug middleware endpoint',
    headers,
    requestUrl: request.url,
    method: request.method,
    timestamp: new Date().toISOString(),
    searchParams: Object.fromEntries(request.nextUrl.searchParams.entries()),
    securityContext: {
      auditId: securityContext.auditId,
      riskScore: securityContext.riskScore,
      geoLocation: securityContext.geoLocation,
      sessionId: securityContext.sessionId
    }
  });
  
  // Log the headers to the console for debugging
  console.log('Middleware debug - Request headers:', headers);
  console.log('Security context:', securityContext);
  
  return response;
}, DEBUG_CONFIG); 