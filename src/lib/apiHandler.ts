import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from './errors';

/**
 * Higher-order function to create API route handlers with error handling
 * This can be used to wrap API route handlers to automatically handle errors
 * 
 * @example
 * // In your API route file:
 * import { createAPIHandler } from '@/lib/apiHandler';
 * 
 * export const GET = createAPIHandler(async (request) => {
 *   // Your API logic here
 *   return NextResponse.json({ data: 'success' });
 * });
 */
export function createAPIHandler(handler: (request: NextRequest) => Promise<NextResponse>) {
  return withErrorHandling(handler);
}

/**
 * Helper function to create multiple API handlers at once
 * This is useful for creating GET, POST, PUT, DELETE handlers in one go
 * 
 * @example
 * // In your API route file:
 * import { createAPIHandlers } from '@/lib/apiHandler';
 * 
 * export const { GET, POST, PUT, DELETE } = createAPIHandlers({
 *   GET: async (request) => {
 *     // GET handler logic
 *     return NextResponse.json({ data: 'success' });
 *   },
 *   POST: async (request) => {
 *     // POST handler logic
 *     return NextResponse.json({ data: 'created' });
 *   },
 * });
 */
export function createAPIHandlers(handlers: {
  GET?: (request: NextRequest) => Promise<NextResponse>;
  POST?: (request: NextRequest) => Promise<NextResponse>;
  PUT?: (request: NextRequest) => Promise<NextResponse>;
  DELETE?: (request: NextRequest) => Promise<NextResponse>;
  PATCH?: (request: NextRequest) => Promise<NextResponse>;
}) {
  const result: Record<string, (request: NextRequest) => Promise<NextResponse>> = {};
  
  for (const [method, handler] of Object.entries(handlers)) {
    if (handler) {
      result[method] = withErrorHandling(handler);
    }
  }
  
  return result;
} 