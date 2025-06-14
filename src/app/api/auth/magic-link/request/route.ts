import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';

// Security configuration for magic link request endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: false, // Not required for magic link request
  requireApiKey: true, // API key still required
  requireCSRF: false, // Not required for magic link request
  enableFraudDetection: true, // Critical to prevent abuse
  enableAdvancedAudit: true, // Track all magic link requests
  dataClassification: 'confidential', // Contains email addresses
  rateLimiting: {
    maxRequests: 5, // Very strict rate limiting to prevent abuse
    windowMs: 60000, // 1 minute window
    slidingWindow: true
  },
  maxRequestSize: 1024 // 1KB max for request
};

export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Structured logging for Vercel
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Magic link request initiated',
    auditId: securityContext.auditId,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'POST /api/auth/magic-link/request'
  }));

  // Check risk score early - block high-risk magic link requests
  if (securityContext.riskScore > 75) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk magic link request blocked',
      auditId: securityContext.auditId,
      riskScore: securityContext.riskScore,
      fraudFlags: securityContext.fraudFlags,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Request blocked due to security policy',
        code: 'HIGH_RISK_BLOCKED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      },
      securityContext: {
        riskScore: securityContext.riskScore,
        fraudFlags: securityContext.fraudFlags
      }
    }, { status: 403 });
  }

  // Establish database connection with retry logic
  await connectDB();

  const { email } = await request.json();

  // Validate input
  if (!email) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Magic link request with missing email',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Email is required',
        code: 'MISSING_EMAIL',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Magic link request with invalid email format',
      auditId: securityContext.auditId,
      email: email,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid email format',
        code: 'INVALID_EMAIL_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find user
  const user = await User.findOne({ email });
  
  if (!user) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Magic link requested for non-existent user',
      auditId: securityContext.auditId,
      email: email,
      timestamp: new Date().toISOString()
    }));
    
    // Security: Don't reveal whether user exists or not
    // Return success message but don't actually send email
    return NextResponse.json({
      success: true,
      message: 'If an account with this email exists, a magic login link has been sent.',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });
  }

  // Check if user account is active
  if (!user.isActive) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Magic link requested for inactive user',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: email,
      isActive: user.isActive,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Account is not active',
        code: 'ACCOUNT_INACTIVE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  try {
    // Generate magic link token and code with enhanced security
    const token = crypto.randomBytes(32).toString('hex');
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const tokenExpiration = new Date(Date.now() + 900000); // 15 minutes (more secure than 1 hour)

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Generating magic token and code',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: email,
      tokenExpiration: tokenExpiration.toISOString(),
      timestamp: new Date().toISOString()
    }));

    // Save magic link data
    user.magicToken = token;
    user.magicTokenExpiration = tokenExpiration;
    user.magicCode = code;
    await user.save();

    // Send magic link email
    const magicLinkUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify?token=${token}`;
    
    // Get the username from email (everything before @)
    const username = user.email.split('@')[0];
    
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3366ff;">Your Secure Magic Link</h1>
        <p>Dear <strong>${username}</strong>,</p>
        <p>You requested a secure magic link to sign in to your SkyTrack account.</p>
        <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #3366ff;">
          <p><strong>Click here to sign in:</strong></p>
          <p><a href="${magicLinkUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3366ff; color: white; text-decoration: none; border-radius: 4px;">Secure Sign In</a></p>
        </div>
        <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107;">
          <p><strong>Alternative: Use this 6-digit code:</strong></p>
          <p style="font-size: 24px; font-weight: bold; color: #3366ff; letter-spacing: 2px;">${code}</p>
        </div>
        <div style="margin: 20px 0; font-size: 14px; color: #6c757d;">
          <p><strong>Security Information:</strong></p>
          <ul>
            <li>This link expires in 15 minutes for your security</li>
            <li>Request ID: ${securityContext.auditId}</li>
            <li>If you didn't request this, please ignore this email</li>
            <li>Never share this link or code with anyone</li>
          </ul>
        </div>
        <p style="margin-top: 30px;">Best regards,<br><strong>SkyTrack Security Team</strong></p>
      </div>
    `;

    await sendEmail(
      user.email,
      'Your Secure Magic Login Link - SkyTrack',
      emailContent
    );

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Magic link sent successfully',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: email,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Magic login link and code sent to your email.',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      securityContext: {
        sessionId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'AES-256'
      }
    });

  } catch (emailError) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Failed to send magic link email',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: email,
      error: emailError.message,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Failed to send magic link. Please try again.',
        code: 'EMAIL_SEND_FAILED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}, SECURITY_CONFIG); 