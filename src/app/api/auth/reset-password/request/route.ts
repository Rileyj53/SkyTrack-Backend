import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';

// Email validation function
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Security configuration for password reset request endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: false, // Not required for password reset request
  requireApiKey: true, // API key required to prevent abuse
  requireCSRF: false, // Not required for password reset request
  enableFraudDetection: true, // Critical to prevent abuse
  enableAdvancedAudit: true, // Track all password reset requests
  dataClassification: 'confidential', // Contains email addresses
  rateLimiting: {
    maxRequests: 3, // Very strict rate limiting to prevent abuse
    windowMs: 300000, // 5 minute window
    slidingWindow: true
  },
  maxRequestSize: 1024 * 2 // 2KB max for reset requests
};

export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Structured logging for Vercel
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Password reset request initiated',
    auditId: securityContext.auditId,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'POST /api/auth/reset-password/request'
  }));

  // Check risk score - block high-risk password reset attempts
  if (securityContext.riskScore > 70) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk password reset request blocked',
      auditId: securityContext.auditId,
      riskScore: securityContext.riskScore,
      fraudFlags: securityContext.fraudFlags,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Password reset blocked due to security policy',
        code: 'HIGH_RISK_RESET',
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
      message: 'Password reset request with missing email',
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
  if (!validateEmail(email)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Password reset request with invalid email format',
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

  try {
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Looking up user for password reset',
      auditId: securityContext.auditId,
      email: email,
      timestamp: new Date().toISOString()
    }));

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Password reset requested for non-existent user',
        auditId: securityContext.auditId,
        email: email,
        timestamp: new Date().toISOString()
      }));
      
      // Return success even if user doesn't exist to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link.',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      });
    }

    // Check if account is active
    if (!user.isActive) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Password reset requested for inactive account',
        auditId: securityContext.auditId,
        userId: user._id.toString(),
        email: email,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Account is deactivated. Please contact support.',
          code: 'ACCOUNT_INACTIVE',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 403 });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Generating password reset token',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: email,
      timestamp: new Date().toISOString()
    }));

    // Generate reset token with enhanced security
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiration = new Date();
    resetTokenExpiration.setMinutes(resetTokenExpiration.getMinutes() + 30); // Token expires in 30 minutes (more secure)

    // Save reset token to user
    user.resetToken = resetToken;
    user.resetTokenExpiration = resetTokenExpiration;
    await user.save();

    // Enhanced email template with security information
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
    const username = user.email.split('@')[0];
    
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3366ff;">Password Reset Request</h1>
        <p>Hi <strong>${username}</strong>,</p>
        <p>You requested a password reset for your SkyTrack account. Click the button below to reset your password:</p>
        <div style="margin: 20px 0; text-align: center;">
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3366ff; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a>
        </div>
        <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107;">
          <p><strong>Security Information:</strong></p>
          <ul>
            <li>This link expires in 30 minutes for your security</li>
            <li>Request ID: ${securityContext.auditId}</li>
            <li>If you didn't request this, please ignore this email</li>
            <li>Never share this link with anyone</li>
          </ul>
        </div>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p style="margin-top: 30px;">Best regards,<br><strong>SkyTrack Security Team</strong></p>
      </div>
    `;

    await sendEmail(
      user.email,
      'Reset Your Password - SkyTrack',
      emailContent
    );

    // Track password reset request in history with enhanced audit data
    user.passwordResetHistory.push({
      changedAt: new Date(),
      ipAddress: securityContext.geoLocation?.country || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });
    await user.save();

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Password reset email sent successfully',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: email,
      tokenExpiration: resetTokenExpiration.toISOString(),
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link.',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      securityContext: {
        sessionId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'AES-256'
      }
    });

  } catch (dbError) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Database error during password reset request',
      auditId: securityContext.auditId,
      email: email,
      error: dbError.message,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Error processing password reset request',
        code: 'DATABASE_ERROR',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}, SECURITY_CONFIG); 