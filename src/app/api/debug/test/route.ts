import { NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Debug endpoint configuration - public test endpoint
const DEBUG_CONFIG: SecurityConfig = {
  requireApiKey: true,
  enableFraudDetection: true,
  dataClassification: 'public',
  rateLimiting: { maxRequests: 200, windowMs: 60000 }
};

export const GET = secureApiRoute(async (request, { securityContext }) => {
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Basic test endpoint accessed',
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    status: 'success',
    message: 'API is working correctly',
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
}, DEBUG_CONFIG); 