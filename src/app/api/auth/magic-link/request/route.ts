import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db';
import { User } from '../../../../../models/User';
import crypto from 'crypto';
import { sendEmail } from '../../../../../lib/email';
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
      return NextResponse.json(
        { error: 'User with this email does not exist' },
        { status: 400 }
      );
    }

    // Generate magic link token and code
    const token = crypto.randomBytes(32).toString('hex');
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code

    // Save magic link data
    user.magicToken = token;
    user.magicTokenExpiration = new Date(Date.now() + 3600000); // 1 hour
    user.magicCode = code;
    await user.save();

    console.log('Generated magic token and code for', user.email);

    // Send magic link email
    const magicLinkUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify?token=${token}`;
    
    // Get the username from email (everything before @)
    const username = user.email.split('@')[0];
    
    const emailContent = `
      <h1>Your Magic Link</h1>
      <p>Dear <strong>${username}</strong>,</p>
      <p>Click the link below to sign in to your account:</p>
      <p><a href="${magicLinkUrl}">Sign In</a></p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>This link will expire in 15 minutes.</p>
      <p>Best regards,<br>Your App Team</p>
    `;

    await sendEmail(
      user.email,
      'Your Magic Login Link',
      emailContent
    );

    return NextResponse.json({
      message: 'Magic login link and code sent to your email.'
    });
  } catch (error) {
    console.error('Magic link request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 