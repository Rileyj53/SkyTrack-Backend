import { NextRequest, NextResponse } from 'next/server';

// Custom error class for API errors
export class APIError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

// Common error types
export const Errors = {
  BadRequest: (message: string, details?: any) => 
    new APIError(message, 400, 'BAD_REQUEST', details),
  
  Unauthorized: (message: string = 'Authentication required', details?: any) => 
    new APIError(message, 401, 'UNAUTHORIZED', details),
  
  Forbidden: (message: string = 'Access denied', details?: any) => 
    new APIError(message, 403, 'FORBIDDEN', details),
  
  NotFound: (message: string = 'Resource not found', details?: any) => 
    new APIError(message, 404, 'NOT_FOUND', details),
  
  Conflict: (message: string, details?: any) => 
    new APIError(message, 409, 'CONFLICT', details),
  
  TooManyRequests: (message: string = 'Too many requests', details?: any) => 
    new APIError(message, 429, 'TOO_MANY_REQUESTS', details),
  
  InternalServerError: (message: string = 'Internal server error', details?: any) => 
    new APIError(message, 500, 'INTERNAL_ERROR', details),
  
  ServiceUnavailable: (message: string = 'Service temporarily unavailable', details?: any) => 
    new APIError(message, 503, 'SERVICE_UNAVAILABLE', details),
};

// Error handler for API routes
export function handleAPIError(error: any, request: NextRequest): NextResponse {
  // Get request ID for tracing
  const requestId = request.headers.get('X-Request-ID') || 'unknown';
  
  // Log the error with request ID
  console.error(`[${new Date().toISOString()}] Error (Request ID: ${requestId}):`, {
    message: error.message,
    code: error instanceof APIError ? error.code : 'UNKNOWN_ERROR',
    statusCode: error instanceof APIError ? error.statusCode : 500,
    path: request.nextUrl.pathname,
    method: request.method,
    details: error instanceof APIError ? error.details : undefined,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
  
  // Determine status code and response format
  const statusCode = error instanceof APIError ? error.statusCode : 500;
  const code = error instanceof APIError ? error.code : 'INTERNAL_ERROR';
  
  // In production, don't expose internal error details to clients
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : error.message;
  
  // Create error response
  const response = NextResponse.json(
    {
      error: {
        message,
        code,
        requestId,
      },
    },
    { status: statusCode }
  );
  
  // Add request ID to response headers
  response.headers.set('X-Request-ID', requestId);
  
  return response;
}

// Wrapper for API route handlers to catch errors
export function withErrorHandling(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      return handleAPIError(error, request);
    }
  };
} 