import { NextRequest, NextResponse } from 'next/server';
import { handleAPIError } from '@/lib/errors';

/**
 * Middleware to handle errors in API routes
 * This should be applied to all API routes
 */
export async function errorHandler(request: NextRequest) {
  try {
    // Continue to the next middleware or route handler
    return NextResponse.next();
  } catch (error) {
    // Handle any errors that occur in the middleware chain
    return handleAPIError(error, request);
  }
} 