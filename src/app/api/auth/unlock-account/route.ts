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

// Security configuration for account unlock endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: false, // Not required for account unlock request
  requireApiKey: true, // API key required to prevent abuse
  requireCSRF: false, // Not required for account unlock request
  enableFraudDetection: true, // Critical to prevent abuse
  enableAdvancedAudit: true, // Track all unlock requests
  dataClassification: 'confidential', // Contains email addresses and account status
  rateLimiting: {
    maxRequests: 3, // Very strict rate limiting to prevent abuse
    windowMs: 300000, // 5 minute window
    slidingWindow: true
  },
  maxRequestSize: 1024 * 2 // 2KB max for unlock requests
};

export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Structured logging for Vercel
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Account unlock request initiated',
    auditId: securityContext.auditId,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'POST /api/auth/unlock-account'
  }));

  // Check risk score - block high-risk unlock attempts
  if (securityContext.riskScore > 70) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk account unlock request blocked',
      auditId: securityContext.auditId,
      riskScore: securityContext.riskScore,
      fraudFlags: securityContext.fraudFlags,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Account unlock blocked due to security policy',
        code: 'HIGH_RISK_UNLOCK',
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
      message: 'Account unlock request with missing email',
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
      message: 'Account unlock request with invalid email format',
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
      message: 'Looking up user for account unlock',
      auditId: securityContext.auditId,
      email: email,
      timestamp: new Date().toISOString()
    }));

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Account unlock requested for non-existent user',
        auditId: securityContext.auditId,
        email: email,
        timestamp: new Date().toISOString()
      }));
      
      // Return success even if user doesn't exist to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If your email is registered, you will receive unlock instructions.',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      });
    }

    // Check if account is actually locked
    if (!user.isLocked) {
      console.info(JSON.stringify({
        level: 'INFO',
        message: 'Unlock requested for account that is not locked',
        auditId: securityContext.auditId,
        userId: user._id.toString(),
        email: email,
        timestamp: new Date().toISOString()
      }));
      
      // Still return success to prevent information disclosure
      return NextResponse.json({
        success: true,
        message: 'If your email is registered, you will receive unlock instructions.',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      });
    }

    // Check if account is active
    if (!user.isActive) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Account unlock requested for inactive account',
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
      message: 'Generating account unlock token',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: email,
      timestamp: new Date().toISOString()
    }));

    // Generate unlock token with enhanced security
    const unlockToken = crypto.randomBytes(32).toString('hex');
    const unlockTokenExpiration = new Date();
    unlockTokenExpiration.setMinutes(unlockTokenExpiration.getMinutes() + 30); // Token expires in 30 minutes (more secure)

    // Save unlock token to user (reusing resetToken fields for unlock functionality)
    user.resetToken = unlockToken;
    user.resetTokenExpiration = unlockTokenExpiration;
    await user.save();

    // Enhanced email template with security information
    const unlockUrl = `${process.env.NEXT_PUBLIC_APP_URL}/unlock-account?token=${unlockToken}`;
    const username = user.email.split('@')[0];
    
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3366ff;">Account Unlock Request</h1>
        <p>Hi <strong>${username}</strong>,</p>
        <p>Your SkyTrack account has been locked due to multiple failed login attempts. Click the button below to unlock your account:</p>
        <div style="margin: 20px 0; text-align: center;">
          <a href="${unlockUrl}" style="display: inline-block; padding: 12px 24px; background-color: #33cc33; color: white; text-decoration: none; border-radius: 4px;">Unlock Account</a>
        </div>
        <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107;">
          <p><strong>Security Information:</strong></p>
          <ul>
            <li>This link expires in 30 minutes for your security</li>
            <li>Request ID: ${securityContext.auditId}</li>
            <li>If you didn't request this, please contact support immediately</li>
            <li>Never share this link with anyone</li>
            <li>Consider enabling two-factor authentication after unlocking</li>
          </ul>
        </div>
        <div style="margin: 20px 0; padding: 15px; background-color: #f8d7da; border-left: 4px solid #dc3545;">
          <p><strong>Account Security Notice:</strong></p>
          <p>Your account was locked after multiple failed login attempts. If this wasn't you, your account may be under attack. Please:</p>
          <ul>
            <li>Change your password immediately after unlocking</li>
            <li>Review your recent account activity</li>
            <li>Enable two-factor authentication</li>
            <li>Contact support if you suspect unauthorized access</li>
          </ul>
        </div>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${unlockUrl}</p>
        <p style="margin-top: 30px;">Best regards,<br><strong>SkyTrack Security Team</strong></p>
      </div>
    `;

    await sendEmail(
      user.email,
      'Account Unlock Request - SkyTrack',
      emailContent
    );

    // Track unlock request in password reset history (security audit trail)
    user.passwordResetHistory.push({
      changedAt: new Date(),
      ipAddress: securityContext.geoLocation?.country || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });
    await user.save();

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Account unlock email sent successfully',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: email,
      tokenExpiration: unlockTokenExpiration.toISOString(),
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'If your email is registered, you will receive unlock instructions.',
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
      message: 'Database error during account unlock request',
      auditId: securityContext.auditId,
      email: email,
      error: dbError.message,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Error processing unlock request',
        code: 'DATABASE_ERROR',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}, SECURITY_CONFIG); 