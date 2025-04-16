import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Log all headers for debugging
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  
  console.log(JSON.stringify({
    type: 'test_with_key_request',
    headers: Object.keys(headers),
    timestamp: new Date().toISOString()
  }));
  
  // Get the API key from either the Authorization header or x-api-key header
  const authHeader = request.headers.get('Authorization');
  const xApiKey = request.headers.get('x-api-key');
  
  console.log(JSON.stringify({
    type: 'test_with_key_auth',
    hasAuthHeader: !!authHeader,
    hasXApiKey: !!xApiKey,
    timestamp: new Date().toISOString()
  }));
  
  let apiKey: string | null = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.split(' ')[1];
  } else if (xApiKey) {
    apiKey = xApiKey;
  }
  
  if (!apiKey) {
    console.warn(JSON.stringify({
      type: 'test_with_key_missing',
      timestamp: new Date().toISOString()
    }));
    return NextResponse.json(
      { 
        error: 'API key is required. Use either Authorization: Bearer <token> or x-api-key header.'
      },
      { status: 401 }
    );
  }
  
  console.log(JSON.stringify({
    type: 'test_with_key_success',
    apiKeyPrefix: apiKey.substring(0, 4) + '...',
    timestamp: new Date().toISOString()
  }));
  
  return NextResponse.json({
    message: 'API key received',
    apiKeyPrefix: apiKey.substring(0, 4) + '...',
    timestamp: new Date().toISOString()
  });
} 