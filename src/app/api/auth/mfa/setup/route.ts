import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../lib/db';
import { User } from '../../../../../models/User';
import { authenticateRequest } from '../../../../../lib/auth';
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

    // Get user from token
    const auth = authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Find user by ID from token
    const userId = auth.userId;
    const user = await User.findById(userId).select('+mfaSecret +mfaBackupCodes');
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if MFA is already enabled
    if (user.mfaEnabled) {
      return NextResponse.json(
        { error: 'MFA is already enabled' },
        { status: 400 }
      );
    }

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

    // Log the setup with redacted sensitive information
    console.log('MFA setup initiated', {
      userId: user._id,
      email: user.email,
      mfaSecretExists: !!mfaData.secret,
      mfaSecretLength: mfaData.secret ? mfaData.secret.length : 0,
      backupCodesCount: mfaData.backupCodes ? mfaData.backupCodes.length : 0,
      testToken: '[REDACTED]'
    });

    return NextResponse.json({
      message: 'MFA setup initiated',
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
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    return NextResponse.json(
      { error: 'Error setting up MFA' },
      { status: 500 }
    );
  }
} 