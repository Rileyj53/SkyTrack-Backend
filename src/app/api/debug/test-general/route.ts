import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get request ID from headers (added by requestLogger middleware)
  const requestId = request.headers.get('X-Request-ID');
  
  return NextResponse.json({
    message: 'General test API endpoint',
    requestId,
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers),
    debugInfo: {
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      acceptLanguage: request.headers.get('accept-language')
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    return NextResponse.json({
      message: 'General test POST endpoint',
      receivedData: body,
      timestamp: new Date().toISOString(),
      debugInfo: {
        bodySize: JSON.stringify(body).length,
        contentType: request.headers.get('content-type'),
        method: request.method
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Invalid JSON payload',
      timestamp: new Date().toISOString(),
      debugInfo: {
        errorMessage: error.message,
        contentType: request.headers.get('content-type')
      }
    }, { status: 400 });
  }
} 