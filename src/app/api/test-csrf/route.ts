import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Get the CSRF token from the header
  const csrfToken = request.headers.get('X-CSRF-Token');
  
  // Get the stored CSRF token from the cookie
  const storedToken = request.cookies.get('csrf-token')?.value;
  
  return NextResponse.json({
    message: 'CSRF protection is working correctly!',
    timestamp: new Date().toISOString(),
    csrfToken: csrfToken ? csrfToken.substring(0, 10) + '...' : 'missing',
    storedToken: storedToken ? storedToken.substring(0, 10) + '...' : 'missing',
  });
} 