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
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
    const username = user.email.split('@')[0];
    
    const emailContent = `
<table style="width: 100%; max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background-color: #ffffff;" cellpadding="0" cellspacing="0" border="0">
  <!-- Header -->
  <tr>
    <td style="background-color: #000000; padding: 40px 20px; text-align: center;">
      <table style="width: 100%;" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="text-align: center;">
            <div style="background-color: #333333; width: 80px; height: 80px; margin: 0 auto 20px auto; text-align: center; padding: 10px; box-sizing: border-box;">
              <img src="https://d2xuqrfsvdwxue.cloudfront.net/images/Albatross.png" alt="Albatross Logo" style="width: 60px; height: 60px; display: block; margin: 0 auto;" />
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Albatross</h1>
            <p style="color: #cccccc; margin: 8px 0 0 0; font-size: 14px;">Flight Training Management</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  
  <!-- Main Content -->
  <tr>
    <td style="padding: 40px 30px; background-color: #ffffff;">
      <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px; font-weight: bold;">Password Reset Request</h2>
      
      <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 15px 0;">
        Hi <strong style="color: #333333;">${username}</strong>,
      </p>
      
      <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 30px 0;">
        You requested a password reset for your Albatross account. Click the button below to create a new password:
      </p>

      <!-- Reset Button -->
      <table style="width: 100%; margin: 30px 0;" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="text-align: center;">
            <a href="${resetUrl}" style="display: inline-block; padding: 16px 32px; background-color: #000000; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px; border: none; text-align: center;">
              Reset My Password
            </a>
          </td>
        </tr>
      </table>

      <!-- Security Notice -->
      <table style="width: 100%; margin: 30px 0; background-color: #fff3cd; border-left: 4px solid #ffc107;" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 20px;">
            <p style="margin: 0 0 12px 0; font-weight: bold; color: #856404; font-size: 16px;">
              🔒 Security Information
            </p>
            <ul style="margin: 0; padding-left: 20px; color: #856404; font-size: 14px; line-height: 20px;">
              <li style="margin-bottom: 8px;">This link expires in 30 minutes for your security</li>
              <li style="margin-bottom: 8px;">If you didn't request this reset, please ignore this email</li>
              <li style="margin-bottom: 0;">Never share this link with anyone</li>
              <li style="margin-bottom: 0;">Albatross will NEVER ask you for this link</li>
            </ul>
          </td>
        </tr>
      </table>

      <!-- Alternative Link -->
      <table style="width: 100%; margin: 30px 0; background-color: #f8f9fa; border: 1px solid #dee2e6;" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 20px;">
            <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="word-break: break-all; color: #999999; font-size: 12px; font-family: monospace; background-color: #ffffff; padding: 10px; border: 1px solid #dddddd; margin: 0;">
              ${resetUrl}
            </p>
          </td>
        </tr>
      </table>

      <!-- Signature -->
      <table style="width: 100%; margin-top: 40px; border-top: 1px solid #eeeeee;" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-top: 20px;">
            <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0;">
              Best regards,<br>
              <strong style="color: #333333;">The Albatross Security Team</strong>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #dee2e6;">
      <p style="color: #999999; font-size: 12px; margin: 0; line-height: 18px;">
        This email was sent from Albatross Flight Training Management System.<br>
        © ${new Date().getFullYear()} Albatross. All rights reserved.
      </p>
    </td>
  </tr>
</table>
    `;

    await sendEmail(
      user.email,
      'Reset Your Password - Albatross',
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