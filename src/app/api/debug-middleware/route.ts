import { NextRequest, NextResponse } from 'next/server';
import { Errors } from '@/lib/errors';
import { createAPIHandler } from '@/lib/apiHandler';

// Example API route with error handling
export const GET = createAPIHandler(async (request: NextRequest) => {
  // Get all request headers
  const headers = Array.from(request.headers.entries());
  
  // Example of throwing a custom error
  if (request.nextUrl.searchParams.has('error')) {
    throw Errors.BadRequest('This is a test error', { param: 'error' });
  }
  
  // Create a response with the headers
  const response = NextResponse.json({
    message: 'Debug endpoint',
    headers,
  });
  
  // Log the headers to the console
  console.log('Request headers:', headers);
  
  return response;
}); 