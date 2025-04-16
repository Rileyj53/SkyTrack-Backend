import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db';
import { User } from '../../../../../models/User';
import crypto from 'crypto';
import sendEmail from '../../../../../lib/email';
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
    console.log('Password reset request for email:', email);

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await User.findOne({ email });
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      // Return success even if user doesn't exist to prevent email enumeration
      return NextResponse.json({
        message: 'If your email is registered, you will receive a password reset link.'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      );
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiration = new Date();
    resetTokenExpiration.setHours(resetTokenExpiration.getHours() + 1); // Token expires in 1 hour

    // Save reset token to user
    user.resetToken = resetToken;
    user.resetTokenExpiration = resetTokenExpiration;
    await user.save();

    // Get client IP and user agent for audit
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Send reset email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
    
    // Get the username from email (everything before @)
    const username = user.email.split('@')[0];
    
    const emailContent = `
      <h1>Password Reset Request</h1>
      <p>Hi <strong>${username}</strong>,</p>
      <p>You requested a password reset for your account. Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
      <p>Best regards,<br>Your App Team</p>
    `;

    await sendEmail(
      user.email,
      'Reset Your Password',
      emailContent
    );

    // Track password reset request in history
    user.passwordResetHistory.push({
      changedAt: new Date(),
      ipAddress,
      userAgent
    });
    await user.save();

    return NextResponse.json({
      message: 'If your email is registered, you will receive a password reset link.'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 