import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';

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

  return NextResponse.json({
    status: 'success',
    message: 'API Keys route is working correctly',
    timestamp: new Date().toISOString()
  });
} 