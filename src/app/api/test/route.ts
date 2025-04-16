import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get request ID from headers (added by requestLogger middleware)
  const requestId = request.headers.get('X-Request-ID');
  
  return NextResponse.json({
    message: 'Test API endpoint',
    requestId,
    timestamp: new Date().toISOString(),
    headers: Object.fromEntries(request.headers)
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    return NextResponse.json({
      message: 'Test POST endpoint',
      receivedData: body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Invalid JSON payload',
      timestamp: new Date().toISOString()
    }, { status: 400 });
  }
} 