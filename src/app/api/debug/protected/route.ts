import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Specify Node.js runtime
export const runtime = 'nodejs';

// Debug endpoint configuration - requires authentication
const DEBUG_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: { maxRequests: 50, windowMs: 60000 }
};

export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Protected debug endpoint accessed',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      timestamp: new Date().toISOString()
    }));

    // Find user by ID from security context
    const userId = securityContext.user?.userId;
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
      message: 'Protected data retrieved successfully',
      auditId: securityContext.auditId,
      userId: user._id,
      userRole: user.role,
      timestamp: new Date().toISOString()
    }));

    // Return protected data with debug information
    return NextResponse.json({
      success: true,
      message: 'Protected data retrieved successfully',
      auditId: securityContext.auditId,
      data: {
        userId: user._id,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      },
      timestamp: new Date().toISOString(),
      debugInfo: {
        requestHeaders: Object.fromEntries(request.headers.entries()),
        authMethod: 'JWT Token + API Key',
        securityContext: {
          riskScore: securityContext.riskScore,
          sessionId: securityContext.sessionId,
          geoLocation: securityContext.geoLocation
        }
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Protected route error',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, DEBUG_CONFIG);

export const POST = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Protected POST endpoint accessed',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      timestamp: new Date().toISOString()
    }));

    // Get request body
    const body = await request.json();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Data received in protected endpoint',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      bodySize: JSON.stringify(body).length,
      timestamp: new Date().toISOString()
    }));

    // Return success response with request data and debug info
    return NextResponse.json({
      success: true,
      message: 'Data received in protected endpoint',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      data: body,
      timestamp: new Date().toISOString(),
      debugInfo: {
        bodySize: JSON.stringify(body).length,
        contentType: request.headers.get('content-type'),
        securityContext: {
          riskScore: securityContext.riskScore,
          sessionId: securityContext.sessionId,
          fraudFlags: securityContext.fraudFlags
        }
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error in protected POST route',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, DEBUG_CONFIG); 