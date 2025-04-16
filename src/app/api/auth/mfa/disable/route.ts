import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db';
import { User } from '../../../../../models/User';
import { authenticateRequest } from '../../../../../lib/auth';
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

    const { token } = await request.json();

    // Get user from token
    const auth = authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Validate input
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate token format
    if (!/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: 'Token must be a 6-digit code' },
        { status: 400 }
      );
    }

    // Find user by ID from token
    const userId = auth.userId;
    const user = await User.findById(userId).select('+mfaSecret +mfaBackupCodes');
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if MFA is enabled
    if (!user.mfaEnabled) {
      return NextResponse.json(
        { error: 'MFA is not enabled' },
        { status: 400 }
      );
    }

    // Verify the token
    const isValid = await user.verifyMFAToken(token);
    
    if (!isValid) {
      console.warn('Invalid MFA disable attempt', {
        userId: user._id,
        email: user.email
      });
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Disable MFA
    await user.disableMFA();

    console.log('MFA disabled', {
      userId: user._id,
      email: user.email
    });

    return NextResponse.json({
      message: 'MFA disabled successfully'
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    return NextResponse.json(
      { error: 'Error disabling MFA' },
      { status: 500 }
    );
  }
} 