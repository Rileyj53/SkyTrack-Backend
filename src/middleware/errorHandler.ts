import { NextRequest, NextResponse } from 'next/server';
import { handleAPIError } from '@/lib/errors';

/**
 * Enterprise-grade error handling middleware
 * Provides comprehensive error handling, logging, and security event tracking
 */

// Error types and their corresponding HTTP status codes
const ERROR_STATUS_MAP = {
  ValidationError: 400,
  CastError: 400,
  MongoServerError: 400,
  JsonWebTokenError: 401,
  TokenExpiredError: 401,
  NotBeforeError: 401,
  UnauthorizedError: 401,
  ForbiddenError: 403,
  NotFoundError: 404,
  ConflictError: 409,
  TooManyRequestsError: 429,
  InternalServerError: 500,
  DatabaseError: 500,
  NetworkError: 502,
  ServiceUnavailableError: 503
} as const;

// Security-related error types that should be logged as security events
const SECURITY_ERROR_TYPES = [
  'JsonWebTokenError',
  'TokenExpiredError',
  'UnauthorizedError',
  'ForbiddenError',
  'TooManyRequestsError',
  'InvalidAPIKeyError',
  'CSRFTokenError',
  'SignatureVerificationError'
];

export interface ErrorContext {
  requestId: string;
  auditId?: string;
  userId?: string;
  ip: string;
  userAgent: string;
  method: string;
  url: string;
  timestamp: string;
  riskScore?: number;
  fraudFlags?: string[];
}

/**
 * Main error handler middleware
 */
export async function errorHandler(request: NextRequest) {
  try {
    // Continue to the next middleware or route handler
    return NextResponse.next();
  } catch (error) {
    // Handle any errors that occur in the middleware chain
    return await handleError(error, request);
  }
}

/**
 * Comprehensive error handling function
 */
export async function handleError(error: any, request: NextRequest): Promise<NextResponse> {
  // Generate error context
  const errorContext = generateErrorContext(request, error);
  
  // Determine error type and status code
  const errorType = getErrorType(error);
  const statusCode = getStatusCode(error, errorType);
  
  // Log the error with appropriate level
  await logError(error, errorContext, errorType);
  
  // Log security events for security-related errors
  if (SECURITY_ERROR_TYPES.includes(errorType)) {
    await logSecurityEvent(error, errorContext, errorType);
  }
  
  // Generate standardized error response
  const errorResponse = generateErrorResponse(error, errorContext, statusCode);
  
  // Add security headers to error response
  const response = NextResponse.json(errorResponse, { status: statusCode });
  addSecurityHeaders(response);
  
  return response;
}

/**
 * Generate error context for logging and tracking
 */
function generateErrorContext(request: NextRequest, error: any): ErrorContext {
  const requestId = crypto.randomUUID();
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  return {
    requestId,
    auditId: error.auditId || requestId,
    userId: error.userId || request.headers.get('x-user-id') || undefined,
    ip,
    userAgent,
    method: request.method,
    url: request.url,
    timestamp: new Date().toISOString(),
    riskScore: error.riskScore,
    fraudFlags: error.fraudFlags
  };
}

/**
 * Determine error type from error object
 */
function getErrorType(error: any): string {
  // Check for custom error types
  if (error.name) return error.name;
  if (error.type) return error.type;
  if (error.code) return error.code;
  
  // Check for common error patterns
  if (error.message?.includes('validation')) return 'ValidationError';
  if (error.message?.includes('unauthorized')) return 'UnauthorizedError';
  if (error.message?.includes('forbidden')) return 'ForbiddenError';
  if (error.message?.includes('not found')) return 'NotFoundError';
  if (error.message?.includes('too many requests')) return 'TooManyRequestsError';
  
  // MongoDB specific errors
  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    if (error.code === 11000) return 'ConflictError'; // Duplicate key
    return 'DatabaseError';
  }
  
  // Default to internal server error
  return 'InternalServerError';
}

/**
 * Get appropriate HTTP status code for error
 */
function getStatusCode(error: any, errorType: string): number {
  // Check if error has explicit status code
  if (error.status) return error.status;
  if (error.statusCode) return error.statusCode;
  
  // Use error type mapping
  return ERROR_STATUS_MAP[errorType as keyof typeof ERROR_STATUS_MAP] || 500;
}

/**
 * Log error with appropriate level and detail
 */
async function logError(error: any, context: ErrorContext, errorType: string): Promise<void> {
  const logLevel = getLogLevel(errorType);
  const sanitizedError = sanitizeErrorForLogging(error);
  
  const logEntry = {
    level: logLevel,
    timestamp: context.timestamp,
    requestId: context.requestId,
    auditId: context.auditId,
    errorType,
    message: sanitizedError.message,
    stack: process.env.NODE_ENV === 'development' ? sanitizedError.stack : undefined,
    context: {
      method: context.method,
      url: sanitizeUrl(context.url),
      ip: context.ip,
      userAgent: context.userAgent,
      userId: context.userId,
      riskScore: context.riskScore,
      fraudFlags: context.fraudFlags
    },
    error: sanitizedError
  };
  
  // Log to console (in production, this would go to your logging service)
  console.log(JSON.stringify(logEntry));
  
  // In production, send to monitoring service (e.g., Sentry, CloudWatch, etc.)
  if (logLevel === 'ERROR' || logLevel === 'CRITICAL') {
    await sendToMonitoringService(logEntry);
  }
}

/**
 * Log security events for security-related errors
 */
async function logSecurityEvent(error: any, context: ErrorContext, errorType: string): Promise<void> {
  const securityEvent = {
    eventType: 'SECURITY_ERROR',
    errorType,
    timestamp: context.timestamp,
    auditId: context.auditId,
    requestId: context.requestId,
    ip: context.ip,
    userAgent: context.userAgent,
    userId: context.userId,
    method: context.method,
    url: sanitizeUrl(context.url),
    riskScore: context.riskScore,
    fraudFlags: context.fraudFlags,
    severity: getSeverity(errorType),
    message: error.message
  };
  
  // Log security event (in production, send to SIEM)
  console.log('SECURITY_EVENT:', JSON.stringify(securityEvent));
  
  // In production, send to security monitoring
  await sendToSecurityMonitoring(securityEvent);
}

/**
 * Generate standardized error response
 */
function generateErrorResponse(error: any, context: ErrorContext, statusCode: number) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Base error response
  const errorResponse: any = {
    error: {
      message: getPublicErrorMessage(error, statusCode),
      code: getErrorCode(error, statusCode),
      requestId: context.requestId,
      timestamp: context.timestamp
    }
  };
  
  // Add audit ID if available (for security tracking)
  if (context.auditId && context.auditId !== context.requestId) {
    errorResponse.error.auditId = context.auditId;
  }
  
  // Add security context for security-related errors
  if (context.riskScore !== undefined || context.fraudFlags?.length) {
    errorResponse.securityContext = {
      riskScore: context.riskScore,
      fraudFlags: context.fraudFlags
    };
  }
  
  // In development, include more details
  if (!isProduction) {
    errorResponse.error.details = {
      type: error.name || 'Unknown',
      stack: error.stack?.split('\n').slice(0, 10) // Limit stack trace
    };
  }
  
  return errorResponse;
}

/**
 * Add security headers to error response
 */
function addSecurityHeaders(response: NextResponse): void {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Add CORS headers if needed
  response.headers.set('Access-Control-Allow-Origin', 'null'); // Restrict on errors
}

/**
 * Utility functions
 */
function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] ||
         request.headers.get('x-real-ip') ||
         request.headers.get('cf-connecting-ip') ||
         '127.0.0.1';
}

function getLogLevel(errorType: string): string {
  if (SECURITY_ERROR_TYPES.includes(errorType)) return 'WARN';
  if (errorType.includes('Internal') || errorType.includes('Database')) return 'ERROR';
  if (errorType.includes('Network') || errorType.includes('Service')) return 'CRITICAL';
  return 'INFO';
}

function getSeverity(errorType: string): string {
  if (errorType.includes('Unauthorized') || errorType.includes('Forbidden')) return 'HIGH';
  if (errorType.includes('TooManyRequests')) return 'MEDIUM';
  if (errorType.includes('Validation')) return 'LOW';
  return 'MEDIUM';
}

function sanitizeErrorForLogging(error: any): any {
  const sanitized = { ...error };
  
  // Remove sensitive information
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'key', 'auth'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) sanitized[field] = '[REDACTED]';
    if (sanitized.message && typeof sanitized.message === 'string') {
      sensitiveFields.forEach(sensitive => {
        const regex = new RegExp(`${sensitive}[\\s]*[:=][\\s]*[\\w\\-\\.]+`, 'gi');
        sanitized.message = sanitized.message.replace(regex, `${sensitive}=[REDACTED]`);
      });
    }
  });
  
  return sanitized;
}

function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove sensitive query parameters
    const sensitiveParams = ['token', 'key', 'password', 'secret', 'auth'];
    sensitiveParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
      }
    });
    return urlObj.toString();
  } catch {
    return url;
  }
}

function getPublicErrorMessage(error: any, statusCode: number): string {
  // Don't expose internal error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    switch (statusCode) {
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Not Found';
      case 409: return 'Conflict';
      case 429: return 'Too Many Requests';
      case 500: return 'Internal Server Error';
      default: return 'An error occurred';
    }
  }
  
  return error.message || 'An error occurred';
}

function getErrorCode(error: any, statusCode: number): string {
  if (error.code) return error.code;
  
  switch (statusCode) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 429: return 'RATE_LIMITED';
    case 500: return 'INTERNAL_ERROR';
    default: return 'UNKNOWN_ERROR';
  }
}

async function sendToMonitoringService(logEntry: any): Promise<void> {
  // In production, integrate with your monitoring service
  // Examples: Sentry, DataDog, New Relic, CloudWatch, etc.
  
  if (process.env.SENTRY_DSN) {
    // Sentry integration example
    // Sentry.captureException(logEntry.error, { contexts: { logEntry } });
  }
  
  if (process.env.CLOUDWATCH_LOG_GROUP) {
    // CloudWatch integration example
    // await cloudwatch.putLogEvents({ ... });
  }
}

async function sendToSecurityMonitoring(securityEvent: any): Promise<void> {
  // In production, integrate with SIEM or security monitoring
  // Examples: Splunk, Elastic Security, AWS Security Hub, etc.
  
  if (process.env.SECURITY_WEBHOOK_URL) {
    // Webhook integration example
    // await fetch(process.env.SECURITY_WEBHOOK_URL, { method: 'POST', body: JSON.stringify(securityEvent) });
  }
} 