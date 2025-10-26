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
  'https://nonprod.albatrossflight.com',
  'https://nonprod-backend.albatrossflight.com',
  'https://api.albatrossflight.com',
  'https://albatrossflight.com',
];

// Function to check if origin matches allowed patterns
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  
  // Check exact matches
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Normalize hostnames so that 'www.example.com' and 'example.com' are treated the same.
  // This allows deploying the frontend on 'https://www.albatrossflight.com' while keeping
  // the canonical allowed origin 'https://albatrossflight.com' in the list.
  try {
    const incoming = new URL(origin);
    const incomingHost = incoming.hostname.replace(/^www\./i, '');

    for (const allowed of ALLOWED_ORIGINS) {
      try {
        const allowedUrl = new URL(allowed);
        const allowedHost = allowedUrl.hostname.replace(/^www\./i, '');

        if (incoming.protocol === allowedUrl.protocol && incomingHost === allowedHost) {
          return true;
        }
      } catch (e) {
        // ignore malformed allowed entries
      }
    }
  } catch (e) {
    // ignore malformed origin
  }

  // Check pattern: any URL ending with -sky-track.vercel.app
  if (origin.endsWith('-sky-track.vercel.app') && origin.startsWith('https://')) {
    return true;
  }

  return false;
}

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
  const isAllowedOrigin = isSameOrigin || isOriginAllowed(origin);
  
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