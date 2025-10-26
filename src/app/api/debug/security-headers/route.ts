import { NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Debug endpoint configuration - public endpoint for testing security headers
const DEBUG_CONFIG: SecurityConfig = {
  requireApiKey: true,
  enableFraudDetection: true,
  dataClassification: 'public',
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

/**
 * Debug endpoint to verify and test security headers
 * @returns A response with comprehensive security headers for testing
 */
export const GET = secureApiRoute(async (request, { securityContext }) => {
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Security headers debug endpoint accessed',
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }));

  // Create a response
  const response = NextResponse.json({
    success: true,
    status: 'success',
    message: 'Security headers debug endpoint',
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    headersApplied: [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Referrer-Policy',
      'Permissions-Policy',
      'Feature-Policy',
      'Strict-Transport-Security',
      'Cache-Control',
      'Cross-Origin-Embedder-Policy',
      'Cross-Origin-Opener-Policy',
      'Cross-Origin-Resource-Policy',
      'Origin-Agent-Cluster',
      'Expect-CT'
    ]
  });
  
  // Explicitly set security headers in the response
  const headers = response.headers;
  
  // Content Security Policy (CSP)
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
  );
  
  // X-Content-Type-Options: Prevents MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff');
  
  // X-Frame-Options: Prevents clickjacking
  headers.set('X-Frame-Options', 'DENY');
  
  // X-XSS-Protection: Basic XSS protection for older browsers
  headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer-Policy: Controls how much referrer information is included with requests
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions-Policy: Restricts which features and APIs can be used
  headers.set(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
  
  // Feature-Policy: Alternative to Permissions-Policy for older browsers
  headers.set(
    'Feature-Policy',
    "accelerometer 'none'; camera 'none'; geolocation 'none'; gyroscope 'none'; magnetometer 'none'; microphone 'none'; payment 'none'; usb 'none'"
  );
  
  // Strict-Transport-Security: Enforces HTTPS connections
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Cache-Control: Controls caching behavior
  headers.set('Cache-Control', 'no-store, max-age=0');
  
  // Cross-Origin-Embedder-Policy: Helps prevent cross-origin attacks
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  
  // Cross-Origin-Opener-Policy: Prevents cross-origin attacks
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  
  // Cross-Origin-Resource-Policy: Prevents cross-origin attacks
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  
  // Origin-Agent-Cluster: Provides additional isolation between origins
  headers.set('Origin-Agent-Cluster', '?1');
  
  // Expect-CT: Helps detect and prevent certificate transparency issues
  headers.set('Expect-CT', 'enforce, max-age=30');
  
  return response;
}, DEBUG_CONFIG); 