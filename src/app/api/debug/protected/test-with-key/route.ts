import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Debug endpoint configuration - requires API key only
const DEBUG_CONFIG: SecurityConfig = {
  requireApiKey: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'internal',
  rateLimiting: { maxRequests: 50, windowMs: 60000 }
};

export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  // Log all headers for debugging
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Test with key endpoint accessed',
    auditId: securityContext.auditId,
    headers: Object.keys(headers),
    timestamp: new Date().toISOString()
  }));
  
  // Get the API key from either the Authorization header or x-api-key header
  const authHeader = request.headers.get('Authorization');
  const xApiKey = request.headers.get('x-api-key');
  
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'API key validation successful',
    auditId: securityContext.auditId,
    hasAuthHeader: !!authHeader,
    hasXApiKey: !!xApiKey,
    timestamp: new Date().toISOString()
  }));
  
  let apiKey: string | null = null;
  let keySource = 'unknown';
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.split(' ')[1];
    keySource = 'Authorization header';
  } else if (xApiKey) {
    apiKey = xApiKey;
    keySource = 'x-api-key header';
  }
  
  // If we reach here, API key validation already passed via secureApiRoute
  const validatedKey = securityContext.apiKey?.key || apiKey || 'unknown';
  
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'API key test completed successfully',
    auditId: securityContext.auditId,
    apiKeyPrefix: validatedKey.substring(0, 4) + '...',
    keySource,
    timestamp: new Date().toISOString()
  }));
  
  return NextResponse.json({
    success: true,
    message: 'API key received and validated',
    auditId: securityContext.auditId,
    apiKeyPrefix: validatedKey.substring(0, 4) + '...',
    timestamp: new Date().toISOString(),
    debugInfo: {
      keySource,
      keyLength: validatedKey.length,
      requestHeaders: Object.keys(headers),
      apiKeyValidated: true,
      securityContext: {
        riskScore: securityContext.riskScore,
        sessionId: securityContext.sessionId,
        geoLocation: securityContext.geoLocation
      }
    }
  });
}, DEBUG_CONFIG); 