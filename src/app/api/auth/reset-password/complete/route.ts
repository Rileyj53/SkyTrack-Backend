import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db';
import { User } from '../../../../../models/User';
import { hashPassword } from '../../../../../lib/auth';
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

    const body = await request.json();
    const { token, password, newPassword } = body;
    console.log('Password reset completion attempt');
    console.log('Request body:', { token, password, newPassword });

    // Use either password or newPassword field
    const resetPassword = password || newPassword;

    // Validate input
    if (!token || !resetPassword) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    // Find user with this reset token
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiration: { $gt: Date.now() }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Get client IP and user agent for audit
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Hash the new password
    const hashedPassword = await hashPassword(resetPassword);
    
    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiration = null;
    
    // Track password change
    await user.trackPasswordChange(ipAddress, userAgent);
    
    // Save the user
    await user.save();

    return NextResponse.json({
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Password reset completion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 