import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db';
import { User } from '../../../../models/User';
import crypto from 'crypto';
import { sendEmail } from '../../../../lib/email';
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

    const { email } = await request.json();

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      // Return success even if user doesn't exist to prevent email enumeration
      return NextResponse.json({
        message: 'If your email is registered, you will receive unlock instructions.'
      });
    }

    // Generate unlock token
    const unlockToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = unlockToken;
    user.resetTokenExpiration = new Date(Date.now() + 3600000); // 1 hour

    await user.save();

    // Send unlock email
    const unlockLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${unlockToken}`;
    await sendEmail(
      user.email,
      'Account Unlock Instructions',
      `
        <h1>Account Unlock Instructions</h1>
        <p>Hello ${user.firstName},</p>
        <p>Your account has been locked due to multiple failed login attempts.</p>
        <p>To unlock your account, please click the link below to reset your password:</p>
        <p><a href="${unlockLink}">${unlockLink}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>Best regards,<br>Your Security Team</p>
      `
    );

    console.log('Account unlock email sent', {
      userId: user._id,
      email: user.email
    });

    return NextResponse.json({
      message: 'If your email is registered, you will receive unlock instructions.'
    });
  } catch (error) {
    console.error('Account unlock error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 