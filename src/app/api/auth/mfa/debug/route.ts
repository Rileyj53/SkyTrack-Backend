import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { authenticateRequest } from '@/lib/auth';
import { validateApiKey } from '@/middleware/apiKeyAuth';

// Connect to MongoDB
connectDB();

export async function GET(request: NextRequest) {
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

    // Return debug information
    return NextResponse.json({
      mfaEnabled: user.mfaEnabled,
      mfaSecret: user.mfaSecret,
      mfaBackupCodes: user.mfaBackupCodes,
      userId: user._id,
      email: user.email
    });
  } catch (error) {
    console.error('MFA debug error:', error);
    return NextResponse.json(
      { error: 'Error getting MFA debug info' },
      { status: 500 }
    );
  }
} 