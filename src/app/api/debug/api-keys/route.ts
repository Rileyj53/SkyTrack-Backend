import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { ApiKey } from '@/models/ApiKey';
import { verifyToken } from '@/lib/jwt';

// Connect to MongoDB
connectDB();

export async function GET(request: NextRequest) {
  // Check for authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify the token and check for sys_admin role
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }

  // Check if the user has the sys_admin role
  if (decoded.role !== 'sys_admin') {
    return NextResponse.json(
      { error: 'Forbidden: Only system administrators can access this endpoint' },
      { status: 403 }
    );
  }

  try {
    // Get all API keys from database for debugging
    const apiKeys = await ApiKey.find({});
    
    return NextResponse.json({
      status: 'success',
      data: apiKeys.map(key => ({
        _id: key._id,
        user: key.user,
        label: key.label,
        key: key.key.substring(0, 10) + '...', // Only show first 10 chars for security
        lastSix: key.lastSix,
        isActive: key.isActive,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt
      })),
      debugInfo: {
        userId: decoded.userId,
        userRole: decoded.role,
        endpoint: '/api/debug/api-keys',
        method: 'GET'
      }
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 