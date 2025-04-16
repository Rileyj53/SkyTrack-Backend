import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Check for authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    status: 'success',
    message: 'API Keys route is working correctly',
    timestamp: new Date().toISOString()
  });
} 