import { NextRequest, NextResponse } from 'next/server';
import { validateCSRFToken } from '@/lib/csrf';

// Paths that are excluded from CSRF protection
const EXCLUDED_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/csrf-token',
  '/api/schools/.*/flight-logs/today'
];

// Methods that don't require CSRF protection
const SAFE_METHODS = ['HEAD', 'OPTIONS'];

// Paths that require CSRF protection even for GET requests
const PROTECTED_GET_PATHS = [
  '/api/schools/'
];

// Export the middleware function as 'csrf'
export const csrf = (request: NextRequest) => {
  // Skip CSRF check for excluded paths
  if (EXCLUDED_PATHS.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Skip CSRF check for safe methods unless it's a protected GET path
  if (SAFE_METHODS.includes(request.method) || 
      (request.method === 'GET' && !PROTECTED_GET_PATHS.some(path => request.nextUrl.pathname.startsWith(path)))) {
    return NextResponse.next();
  }

  // Get CSRF token from header
  const csrfToken = request.headers.get('x-csrf-token');
  if (!csrfToken) {
    return NextResponse.json(
      { error: 'CSRF token is required' },
      { status: 403 }
    );
  }

  // Get stored token from cookie
  const storedToken = request.cookies.get('csrf-token')?.value;
  if (!storedToken) {
    return NextResponse.json(
      { error: 'No CSRF token found in cookies' },
      { status: 403 }
    );
  }

  // Validate the token
  if (!validateCSRFToken(csrfToken, storedToken)) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    );
  }

  return NextResponse.next();
}; 