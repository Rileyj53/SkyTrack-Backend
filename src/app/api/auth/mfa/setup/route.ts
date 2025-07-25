import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

// Security configuration for MFA setup endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true, // Authentication required
  requireApiKey: true, // API key required
  requireCSRF: true, // CSRF protection for security setup
  allowedRoles: ['sys_admin', 'school_admin', 'instructor', 'student', 'mechanic', 'member'], // All authenticated users
  enableFraudDetection: true, // Monitor MFA setup attempts
  enableAdvancedAudit: true, // Track all MFA security changes
  dataClassification: 'restricted', // MFA setup is highly sensitive
  rateLimiting: {
    maxRequests: 3, // Very strict rate limiting for MFA setup
    windowMs: 60000, // 1 minute window
    slidingWindow: true
  },
  maxRequestSize: 1024 // 1KB max for MFA requests
};

export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Structured logging for Vercel
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'MFA setup request initiated',
    auditId: securityContext.auditId,
    userId: securityContext.user?.id,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'POST /api/auth/mfa/setup'
  }));

  // Check risk score - MFA setup is a critical security operation
  if (securityContext.riskScore > 70) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk MFA setup attempt blocked',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      riskScore: securityContext.riskScore,
      fraudFlags: securityContext.fraudFlags,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'MFA setup blocked due to security policy',
        code: 'HIGH_RISK_MFA_SETUP',
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

  try {
    // Find user by ID from security context
    const userId = securityContext.user?.id;
    const user = await User.findById(userId).select('+mfaSecret +mfaBackupCodes');
    
    if (!user) {
      console.error(JSON.stringify({
        level: 'ERROR',
        message: 'User not found during MFA setup',
        auditId: securityContext.auditId,
        userId: userId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    // Check if MFA is already enabled
    if (user.mfaEnabled) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Attempt to setup MFA when already enabled',
        auditId: securityContext.auditId,
        userId: user._id.toString(),
        email: user.email,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'MFA is already enabled',
          code: 'MFA_ALREADY_ENABLED',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Generating MFA credentials',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      timestamp: new Date().toISOString()
    }));

    // Generate MFA credentials
    const mfaData = await user.generateMFA();
    
    // Save the MFA secret and backup codes to the user
    user.mfaSecret = mfaData.secret;
    user.mfaBackupCodes = mfaData.backupCodes.map(code => ({
      code,
      used: false
    }));
    user.mfaEnabled = true;
    user.mfaVerified = false;
    await user.save();

    // Create a data URL for the QR code
    const qrCodeDataUrl = `data:image/png;base64,${mfaData.qrCode}`;

    const processingTime = Date.now() - startTime;

    // Log the setup with redacted sensitive information
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'MFA setup completed successfully',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      mfaSecretExists: !!mfaData.secret,
      mfaSecretLength: mfaData.secret ? mfaData.secret.length : 0,
      backupCodesCount: mfaData.backupCodes ? mfaData.backupCodes.length : 0,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'MFA setup initiated',
      data: {
        qrCode: qrCodeDataUrl,
        qrCodeType: 'data:image/png;base64',
        backupCodes: mfaData.backupCodes,
        secret: mfaData.secret,
        instructions: [
          'Option 1 - Scan QR Code:',
          '   a. Copy the entire qrCode string (including "data:image/png;base64,")',
          '   b. Open a new browser tab and paste the entire string in the address bar',
          '   c. The QR code will be displayed in the browser',
          '   d. Scan the displayed QR code with your authenticator app',
          '',
          'Option 2 - Manual Entry:',
          '   a. Open your authenticator app',
          '   b. Choose "Enter setup key" or "Manual entry"',
          '   c. Enter the secret key shown above',
          '',
          'After setup:',
          '1. You will see a 6-digit code in your app',
          '2. Use that code to verify your MFA setup',
          '3. Save your backup codes in a secure place'
        ]
      },
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
      message: 'Database error during MFA setup',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      error: dbError.message,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Error setting up MFA',
        code: 'DATABASE_ERROR',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}, SECURITY_CONFIG); 