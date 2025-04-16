import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken } from '@/lib/csrf';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Generate a new CSRF token with expiration
    const csrfToken = generateCSRFToken();
    
    // Set the token in a cookie without URL encoding
    const cookieStore = cookies();
    cookieStore.set('csrf-token', csrfToken.token, {
      httpOnly: false, // Allow JavaScript to read this cookie
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      // Set cookie expiration to match token expiration
      maxAge: Math.floor((csrfToken.expires - Date.now()) / 1000)
    });

    // Return the token to the client
    return NextResponse.json({ 
      token: csrfToken.token,
      expires: csrfToken.expires
    });
  } catch (error) {
    console.error('Error generating CSRF token:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
} 