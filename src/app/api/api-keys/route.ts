import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { connectDB } from '@/lib/db';
import { ApiKey } from '@/models/ApiKey';

export async function GET(request: NextRequest) {
  try {
    // Connect to the database
    await connectDB();

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
        { error: 'Forbidden: Only system administrators can list API keys' },
        { status: 403 }
      );
    }

    // Get all API keys
    const apiKeys = await ApiKey.find()
      .select('-key') // Exclude the actual key from the response
      .sort({ created_at: -1 });

    return NextResponse.json({
      status: 'success',
      data: apiKeys
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 