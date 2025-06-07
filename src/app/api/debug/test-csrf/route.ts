import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Get the CSRF token from the header
  const csrfToken = request.headers.get('X-CSRF-Token');
  
  // Get the stored CSRF token from the cookie
  const storedToken = request.cookies.get('csrf-token')?.value;
  
  return NextResponse.json({
    message: 'CSRF protection debug endpoint',
    timestamp: new Date().toISOString(),
    csrfToken: csrfToken ? csrfToken.substring(0, 10) + '...' : 'missing',
    storedToken: storedToken ? storedToken.substring(0, 10) + '...' : 'missing',
    debugInfo: {
      hasCSRFHeader: !!csrfToken,
      hasCSRFCookie: !!storedToken,
      tokensMatch: csrfToken === storedToken,
      headerKeys: Array.from(request.headers.keys()),
      cookieKeys: request.cookies.getAll().map(cookie => cookie.name)
    }
  });
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'CSRF debug endpoint (GET method - no CSRF validation required)',
    timestamp: new Date().toISOString(),
    availableCookies: request.cookies.getAll().map(cookie => ({
      name: cookie.name,
      valuePreview: cookie.value.substring(0, 10) + '...'
    })),
    debugInfo: {
      method: 'GET',
      csrfRequired: false,
      note: 'Use POST method to test CSRF validation'
    }
  });
} 