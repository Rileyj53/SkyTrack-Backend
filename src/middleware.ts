import { NextRequest, NextResponse } from 'next/server';
import { cors } from './middleware/cors';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './middleware/rateLimiter';
import { securityHeaders } from './middleware/securityHeaders';
import { csrf } from './middleware/csrf';
import { errorHandler } from './middleware/errorHandler';
import { handleAPIError } from '@/lib/errors';
import { validateEnv } from '@/lib/env';

// Validate environment variables
validateEnv();

// Define paths that should be excluded from middleware
const EXCLUDED_PATHS = [
  '/_next',
  '/static',
  '/favicon.ico',
  '/api/health',
];

// Define paths that should be excluded from rate limiting
const EXCLUDED_RATE_LIMIT_PATHS = [
  '/api/health',
];

// Define paths that require API key authentication
const API_KEY_REQUIRED_PATHS = [
  '/api/protected',
  '/api/data',
];

// Helper function to safely copy headers
function copyHeaders(source: NextResponse, target: NextResponse) {
  if (source.headers && target.headers) {
    source.headers.forEach((value, key) => {
      target.headers.set(key, value);
    });
  }
  return target;
}

/**
 * Middleware function that runs on every request
 * @param request The incoming request
 * @returns The response with security headers
 */
export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    
    // Skip middleware for excluded paths
    if (EXCLUDED_PATHS.some(path => pathname.startsWith(path))) {
      return NextResponse.next();
    }
    
    // Start with a base response
    let response = NextResponse.next();
    
    // Apply security headers
    const securityResponse = securityHeaders(request);
    response = copyHeaders(securityResponse, response);
    
    // Apply CORS
    const corsResponse = cors(request);
    if (corsResponse.status !== 200 && corsResponse.status !== 204) {
      return corsResponse;
    }
    response = copyHeaders(corsResponse, response);
    
    // Apply CSRF protection to all requests except login and register
    if (!pathname.startsWith('/api/auth/login') && 
        !pathname.startsWith('/api/auth/register') && 
        !pathname.includes('/flight-logs/today')) {
      const csrfResponse = csrf(request);
      if (csrfResponse.status !== 200) {
        return csrfResponse;
      }
      response = copyHeaders(csrfResponse, response);
    }
    
    // Apply rate limiting to non-excluded paths
    if (!EXCLUDED_RATE_LIMIT_PATHS.some(path => pathname.startsWith(path))) {
      const rateLimitResponse = rateLimiter(request);
      if (rateLimitResponse.status !== 200) {
        return rateLimitResponse;
      }
      response = copyHeaders(rateLimitResponse, response);
    }
    
    // Apply request logging
    const loggedResponse = await requestLogger(request);
    response = copyHeaders(loggedResponse, response);
    
    // Apply error handling
    const errorHandledResponse = await errorHandler(request);
    if (errorHandledResponse.status !== 200) {
      return errorHandledResponse;
    }
    response = copyHeaders(errorHandledResponse, response);
    
    return response;
  } catch (error) {
    // Handle any errors that occur in the middleware chain
    return handleAPIError(error, request);
  }
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 