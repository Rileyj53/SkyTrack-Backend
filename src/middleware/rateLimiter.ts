import { NextRequest, NextResponse } from 'next/server';

// Rate limit configuration - more balanced settings
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 300; // 300 requests per 5 minutes (1 request per second on average)

// Store for rate limit data
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(request: NextRequest) {
  // Generate a unique identifier for the client
  const clientId = getClientId(request);
  const now = Date.now();
  
  // Get or create rate limit data for this client
  let rateLimitData = rateLimitStore.get(clientId);
  
  if (!rateLimitData || now > rateLimitData.resetTime) {
    // Reset rate limit data
    rateLimitData = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW
    };
    rateLimitStore.set(clientId, rateLimitData);
  }
  
  // Increment request count
  rateLimitData.count++;
  
  // Check if rate limit exceeded
  if (rateLimitData.count > MAX_REQUESTS_PER_WINDOW) {
    console.log(`Rate limit exceeded for client: ${clientId}`);
    
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Content-Type': 'text/plain',
        'Retry-After': Math.ceil((rateLimitData.resetTime - now) / 1000).toString(),
        'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitData.resetTime.toString()
      }
    });
  }
  
  // Continue with the request
  const response = NextResponse.next();
  
  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW.toString());
  response.headers.set('X-RateLimit-Remaining', (MAX_REQUESTS_PER_WINDOW - rateLimitData.count).toString());
  response.headers.set('X-RateLimit-Reset', rateLimitData.resetTime.toString());
  
  return response;
}

// Helper function to get a unique client identifier
function getClientId(request: NextRequest): string {
  // Try to get a stable identifier from various sources
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Create a simple hash by combining IP and user agent
  // This is simpler than using crypto API which can cause issues in Edge runtime
  return `${ip}-${userAgent}`.replace(/[^a-zA-Z0-9]/g, '-');
} 