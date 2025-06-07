import { NextRequest, NextResponse } from 'next/server';
import { Errors } from '@/lib/errors';
import { createAPIHandler } from '@/lib/apiHandler';

// Debug endpoint for testing middleware functionality
export const GET = createAPIHandler(async (request: NextRequest) => {
  // Get all request headers
  const headers = Array.from(request.headers.entries());
  
  // Example of throwing a custom error for testing
  if (request.nextUrl.searchParams.has('error')) {
    throw Errors.BadRequest('This is a test error for middleware debugging', { param: 'error' });
  }
  
  // Create a response with the headers and debug info
  const response = NextResponse.json({
    message: 'Debug middleware endpoint',
    headers,
    requestUrl: request.url,
    method: request.method,
    timestamp: new Date().toISOString(),
    searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
  });
  
  // Log the headers to the console for debugging
  console.log('Middleware debug - Request headers:', headers);
  
  return response;
}); 