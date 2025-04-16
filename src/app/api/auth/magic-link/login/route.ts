import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db';
import { User } from '../../../../../models/User';
import { generateToken } from '../../../../../lib/jwt';
import { generateCSRFToken } from '../../../../../lib/csrf';
import { validateApiKey } from '@/middleware/apiKeyAuth';

// Connect to MongoDB
connectDB();

export async function POST(request: NextRequest) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { token, code } = await request.json();

    // Validate input
    if (!token && !code) {
      return NextResponse.json(
        { error: 'Either token or code is required' },
        { status: 400 }
      );
    }

    // Find user with valid magic token or code
    const user = await User.findOne({
      $or: [{ magicToken: token }, { magicCode: code }],
      magicTokenExpiration: { $gt: Date.now() }
    });

    if (!user) {
      console.warn('Invalid or expired magic link or code attempted');
      return NextResponse.json(
        { error: 'Invalid or expired magic link or code' },
        { status: 400 }
      );
    }

    console.log('User authenticated using magic link or code:', user.email);

    // Clear magic link data
    user.magicToken = null;
    user.magicTokenExpiration = null;
    user.magicCode = null;
    await user.save();

    // Generate tokens
    const authToken = generateToken(user);
    const csrfToken = generateCSRFToken();

    // Create response with token
    const response = NextResponse.json({
      message: 'Logged in successfully',
      token: authToken,
      csrfToken
    });

    // Set HTTP-only cookie with JWT token
    response.cookies.set('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    // Set CSRF token cookie
    response.cookies.set('csrf-token', JSON.stringify(csrfToken), {
      httpOnly: false, // Allow JavaScript to read this cookie
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;
  } catch (error) {
    console.error(JSON.stringify({
      type: 'magic_link_login_error',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 