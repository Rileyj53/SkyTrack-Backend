import { NextRequest, NextResponse } from 'next/server';

// Allowed origins - update these with your actual domains
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://your-production-domain.com',
  'https://your-staging-domain.com'
];

// Allowed methods
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'];

// Allowed headers
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'Origin',
  'X-API-Key'
];

export function cors(request: NextRequest) {
  const origin = request.headers.get('origin');
  const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    
    if (isAllowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
      response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
      response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
    }
    
    return response;
  }
  
  // Handle actual request
  const response = NextResponse.next();
  
  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  return response;
} 