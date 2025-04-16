import { NextRequest, NextResponse } from 'next/server';
import { validateCSRFToken } from '../lib/csrf';

// Define paths that should be excluded from CSRF protection
const EXCLUDED_PATHS = [
  '/_next',
  '/static',
  '/favicon.ico',
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/resend-verification',
  '/api/auth/verify',
  '/api/auth/csrf-token',
];

// Define paths that should be excluded from CSRF protection for specific HTTP methods
const EXCLUDED_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// CSRF token expiration time in milliseconds (7 days)
const CSRF_TOKEN_EXPIRATION = 7 * 24 * 60 * 60 * 1000;

export function csrfProtection(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  
  // Skip CSRF protection for excluded paths
  if (EXCLUDED_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  // Skip CSRF protection for excluded HTTP methods
  if (EXCLUDED_METHODS.includes(method)) {
    return NextResponse.next();
  }
  
  // Get the CSRF token from the header
  const csrfToken = request.headers.get('X-CSRF-Token');
  if (!csrfToken) {
    console.error(JSON.stringify({
      type: 'csrf_missing_header',
      path: pathname,
      method: method,
      timestamp: new Date().toISOString()
    }));
    return NextResponse.json(
      { error: 'CSRF token is required' },
      { status: 403 }
    );
  }
  
  // Get the stored CSRF token from the cookie
  const storedToken = request.cookies.get('csrf-token')?.value;
  if (!storedToken) {
    console.error(JSON.stringify({
      type: 'csrf_missing_cookie',
      path: pathname,
      method: method,
      timestamp: new Date().toISOString()
    }));
    return NextResponse.json(
      { error: 'No stored CSRF token' },
      { status: 403 }
    );
  }
  
  // Verify the CSRF token
  const isValid = validateCSRFToken(csrfToken, storedToken);
  if (!isValid) {
    console.error(JSON.stringify({
      type: 'csrf_token_mismatch',
      path: pathname,
      method: method,
      headerTokenPrefix: csrfToken.substring(0, 4) + '...',
      cookieTokenPrefix: storedToken.substring(0, 4) + '...',
      timestamp: new Date().toISOString()
    }));
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    );
  }
  
  // Check if the token is expired
  try {
    const parsedToken = JSON.parse(storedToken);
    if (parsedToken.expires && Date.now() > parsedToken.expires) {
      console.error(JSON.stringify({
        type: 'csrf_token_expired',
        path: pathname,
        method: method,
        timestamp: new Date().toISOString()
      }));
      return NextResponse.json(
        { error: 'CSRF token has expired' },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error(JSON.stringify({
      type: 'csrf_token_parse_error',
      path: pathname,
      method: method,
      timestamp: new Date().toISOString()
    }));
    return NextResponse.json(
      { error: 'Invalid CSRF token format' },
      { status: 403 }
    );
  }
  
  return NextResponse.next();
} 