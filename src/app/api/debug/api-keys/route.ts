import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { ApiKey } from '@/models/ApiKey';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Debug endpoint configuration - requires sys_admin role
const DEBUG_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  allowedRoles: ['sys_admin'],
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
      message: 'Debug API keys endpoint accessed',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      timestamp: new Date().toISOString()
    }));

    // Get all API keys from database for debugging
    const apiKeys = await ApiKey.find({});
    
    const sanitizedKeys = apiKeys.map(key => ({
      _id: key._id,
      user: key.user,
      label: key.label,
      key: key.key.substring(0, 10) + '...', // Only show first 10 chars for security
      lastSix: key.lastSix,
      isActive: key.isActive,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt
    }));

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'API keys retrieved successfully',
      auditId: securityContext.auditId,
      keysCount: apiKeys.length,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'API keys retrieved successfully',
      data: sanitizedKeys,
      auditId: securityContext.auditId,
      debugInfo: {
        userId: securityContext.user?.userId,
        userRole: securityContext.user?.role,
        endpoint: '/api/debug/api-keys',
        method: 'GET',
        totalKeys: apiKeys.length,
        activeKeys: apiKeys.filter(key => key.isActive).length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error fetching API keys',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, DEBUG_CONFIG); 