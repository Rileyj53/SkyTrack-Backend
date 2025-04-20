import { NextRequest, NextResponse } from 'next/server';

// Allowed origins - update these with your actual domains
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
  'http://localhost:3006',
  'http://localhost:3007',
  'http://localhost:3008',
  'http://localhost:3009',
  'http://localhost:3010',
  'https://skytrack.com',
  'https://www.skytrack.com',
  'https://app.skytrack.com',
  'https://admin.skytrack.com',
  'https://api.skytrack.com',
  'https://sky-track-frontend-3rgbu8g4i-sky-track.vercel.app',
  'https://skytrack-nonprod-frontend.rileyjacobson.net',
  'https://skytrack-nonprod-backend.rileyjacobson.net'
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
  'x-api-key',
  'X-CSRF-Token'
];

export function cors(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  // Allow requests from the same origin as the backend
  const isSameOrigin = !origin || origin === request.nextUrl.origin;
  const isAllowedOrigin = isSameOrigin || (origin && ALLOWED_ORIGINS.includes(origin));
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    
    if (isAllowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
      response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
      response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
      response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    return response;
  }
  
  // Handle actual request
  const response = NextResponse.next();
  
  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  return response;
} 