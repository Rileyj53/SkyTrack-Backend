import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db';
import { BlacklistedToken } from '../../../../models/BlacklistedToken';
import { decodeToken } from '../../../../lib/jwt';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';

// Connect to MongoDB
connectDB();

export async function POST(request: NextRequest) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the token from the Authorization header
    const token = request.headers.get('Authorization')?.split(' ')[1];

    if (token) {
      // Decode the token to get its expiration
      const decoded = decodeToken(token);
      if (decoded && decoded.exp) {
        // Add token to blacklist with its expiration time
        const blacklistedToken = new BlacklistedToken({
          token,
          blacklistedAt: new Date(),
          expiresAt: new Date(decoded.exp * 1000), // Convert seconds to milliseconds
        });
        await blacklistedToken.save();
      }
    }

    // Create response
    const response = NextResponse.json({
      message: 'Logged out successfully',
    });

    // Clear the token cookie
    response.cookies.set('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0
    });

    // Clear the CSRF token cookie
    response.cookies.set('csrf-token', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0
    });

    console.log(JSON.stringify({
      type: 'logout_success',
      userId: auth.userId,
      timestamp: new Date().toISOString()
    }));

    return response;
  } catch (error) {
    console.error(JSON.stringify({
      type: 'logout_error',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
