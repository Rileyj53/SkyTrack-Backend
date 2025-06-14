import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Debug endpoint configuration - requires authentication
const DEBUG_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: { maxRequests: 20, windowMs: 60000 }
};

export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'MFA debug endpoint accessed',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      timestamp: new Date().toISOString()
    }));

    // Find user by ID from security context
    const userId = securityContext.user?.userId;
    const user = await User.findById(userId).select('+mfaSecret +mfaBackupCodes');
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'MFA debug information retrieved',
      auditId: securityContext.auditId,
      userId: user._id,
      mfaEnabled: user.mfaEnabled,
      timestamp: new Date().toISOString()
    }));

    // Return debug information with enhanced details
    return NextResponse.json({
      success: true,
      message: 'MFA debug information retrieved',
      auditId: securityContext.auditId,
      data: {
        mfaEnabled: user.mfaEnabled,
        mfaVerified: user.mfaVerified,
        mfaSecret: user.mfaSecret,
        mfaBackupCodes: user.mfaBackupCodes,
        userId: user._id,
        email: user.email,
        backupCodesCount: user.mfaBackupCodes ? user.mfaBackupCodes.length : 0,
        unusedBackupCodes: user.mfaBackupCodes ? user.mfaBackupCodes.filter(code => !code.used).length : 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'MFA debug error',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, DEBUG_CONFIG); 