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
    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/magic-login/${token}`;
    await sendEmail(
      user.email,
      'Your Magic Login Link',
        `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
              <title>Your Magic Login Link</title>
            </head>
            <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; color: #333;">
              <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
                <h2 style="color: #2c3e50;">Your Magic Login Link</h2>
                <p>Dear <strong>${user.firstName}</strong>,</p>
                <p>You requested a magic login link. Click the button below to log in immediately:</p>
          
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${magicLink}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Log In Now</a>
                </p>
          
                <p style="text-align: center; font-size: 16px; margin: 20px 0;">
                  Or use this one-time code:
                  <br />
                  <span style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${code}</span>
                </p>
          
                <p style="text-align: center; font-size: 14px; color: #666; margin: 15px 0;">
                  If the button above doesn't work, copy and paste this link into your browser:<br />
                  <a href="${magicLink}" style="color: #007BFF; word-break: break-all;">${magicLink}</a>
                </p>
          
                <p>This link and code are valid for 1 hour.</p>
                <p>If you did not request this, please ignore this email.</p>
                <p>Best regards,<br>Your Security Team</p>
              </div>
            </body>
          </html>
          `

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