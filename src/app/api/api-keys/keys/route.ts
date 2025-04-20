import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { listApiKeys } from '@/lib/apiKeys';

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify the token
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

    // Get the API keys
    const apiKeys = await listApiKeys(decoded.userId);

    return NextResponse.json({
      status: 'success',
      data: apiKeys
    });
  } catch (error) {
    console.error('API key listing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 