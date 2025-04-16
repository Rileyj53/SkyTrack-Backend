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
    
    // Get user from auth header
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

    // Check if token is "[REDACTED]" and return a helpful error
    if (token === '[REDACTED]') {
      console.warn(JSON.stringify({
        type: 'mfa_token_placeholder',
        userId: auth.userId,
        timestamp: new Date().toISOString()
      }));
      return NextResponse.json({
        error: 'Invalid token format. The token appears to be a placeholder "[REDACTED]" instead of the actual 6-digit code. Please provide the actual 6-digit code from your authenticator app.'
      }, { status: 400 });
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

    // Check if MFA is enabled but not verified
    if (!user.mfaEnabled || user.mfaVerified) {
      console.warn(JSON.stringify({
        type: 'invalid_mfa_state',
        userId: user._id,
        mfaEnabled: user.mfaEnabled,
        mfaVerified: user.mfaVerified,
        timestamp: new Date().toISOString()
      }));
      return NextResponse.json({
        error: 'Invalid MFA state. Please setup MFA first.'
      }, { status: 400 });
    }

    // Log the verification attempt (with redacted sensitive info)
    console.log(JSON.stringify({
      type: 'mfa_verification_attempt',
      userId: user._id,
      tokenLength: token.length,
      mfaSecretExists: !!user.mfaSecret,
      mfaSecretLength: user.mfaSecret ? user.mfaSecret.length : 0,
      timestamp: new Date().toISOString()
    }));

    // Verify the token
    const isValid = await user.verifyMFAToken(token);
    
    if (!isValid) {
      console.warn(JSON.stringify({
        type: 'invalid_mfa_token',
        userId: user._id,
        tokenLength: token.length,
        timestamp: new Date().toISOString()
      }));
      return NextResponse.json({
        error: 'Invalid verification code. Please try again with a fresh code from your authenticator app.'
      }, { status: 400 });
    }

    // Mark MFA as verified
    user.mfaVerified = true;
    await user.save();

    console.log(JSON.stringify({
      type: 'mfa_verification_success',
      userId: user._id,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      message: 'MFA verification successful',
      mfaEnabled: true,
      mfaVerified: true
    });
  } catch (error) {
    console.error(JSON.stringify({
      type: 'mfa_verification_error',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    return NextResponse.json(
      { error: 'Error verifying MFA' },
      { status: 500 }
    );
  }
} 