import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Debug endpoint configuration - requires API key
const DEBUG_CONFIG: SecurityConfig = {
  requireApiKey: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'internal',
  rateLimiting: { maxRequests: 50, windowMs: 60000 }
};

export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'API key test endpoint accessed',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    }));

    // Get user from the security context (API key validation already done)
    const userId = securityContext.apiKey?.userId;
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID not found in API key context',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const user = await User.findById(userId);
    
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
      message: 'API key validation successful',
      auditId: securityContext.auditId,
      userId: user._id,
      userRole: user.role,
      timestamp: new Date().toISOString()
    }));

    // Return success response with debug info
    return NextResponse.json({
      success: true,
      message: 'API key is valid',
      auditId: securityContext.auditId,
      data: {
        userId: user._id,
        email: user.email,
        userRole: user.role,
        isActive: user.isActive
      },
      timestamp: new Date().toISOString(),
      debugInfo: {
        apiKeyValidation: 'successful',
        userLookup: 'successful',
        endpoint: '/api/debug/test-api-key',
        securityContext: {
          riskScore: securityContext.riskScore,
          sessionId: securityContext.sessionId
        }
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Test API key error',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, DEBUG_CONFIG); 