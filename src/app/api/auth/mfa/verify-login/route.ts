import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { authenticateRequest } from '@/lib/auth';
import { generateToken } from '@/lib/jwt';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { generateCSRFToken } from '@/lib/csrf';

// Connect to MongoDB
connectDB();

export async function POST(request: NextRequest) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get user from token
    const auth = authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get token from request body
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate token format
    if (!/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      );
    }

    // Find user by ID from token
    const userId = auth.userId;
    const user = await User.findById(userId).select('+mfaSecret');
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify MFA token
    const isValid = await user.verifyMFAToken(token);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid MFA token' },
        { status: 401 }
      );
    }

    // Generate final tokens
    const jwtToken = generateToken(user);
    const csrfToken = generateCSRFToken();

    // Set cookies
    const response = NextResponse.json({
      message: 'MFA verification successful',
      userId: user._id,
      email: user.email
    });

    // Set JWT token cookie
    response.cookies.set('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    // Set CSRF token cookie
    response.cookies.set('csrf-token', JSON.stringify(csrfToken), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;
  } catch (error) {
    console.error('MFA verification error:', error);
    return NextResponse.json(
      { error: 'Error verifying MFA token' },
      { status: 500 }
    );
  }
} 