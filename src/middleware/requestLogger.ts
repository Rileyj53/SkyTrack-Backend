import { NextRequest, NextResponse } from 'next/server';

// Generate a unique ID for each request
function generateRequestId(): string {
  // Use a timestamp + random number for uniqueness
  return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

// Safely stringify request body, redacting sensitive fields
function safeStringifyBody(body: any): string {
  if (!body) return '';
  
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey', 'authorization'];
  const redactedBody = { ...body };
  
  // Redact sensitive fields
  Object.keys(redactedBody).forEach(key => {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      redactedBody[key] = '[REDACTED]';
    }
  });
  
  return JSON.stringify(redactedBody);
}

export async function requestLogger(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // Get request details
  const method = request.method;
  const path = request.nextUrl.pathname;
  const query = request.nextUrl.search;
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Clone the request to read the body
  const clonedRequest = request.clone();
  let body = '';
  
  // Only try to read body for POST, PUT, PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const jsonBody = await clonedRequest.json();
        body = safeStringifyBody(jsonBody);
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await clonedRequest.formData();
        const formBody = Object.fromEntries(formData);
        body = safeStringifyBody(formBody);
      }
    } catch (error) {
      body = '[Unable to parse body]';
    }
  }
  
  // Log request details
  console.log(`REQUEST [${method} ${path}${query}] - IP: ${ip} - UA: ${userAgent} - ID: ${requestId}${body ? ` - Body: ${body}` : ''}`);
  
  // Get response
  const response = NextResponse.next();
  
  // Calculate response time
  const responseTime = Date.now() - startTime;
  
  // Log response details
  console.log(`RESPONSE [${method} ${path}] - ${response.status} (${responseTime}ms) - ID: ${requestId}`);
  
  // Add request ID to response headers for tracing
  response.headers.set('X-Request-ID', requestId);
  response.headers.set('X-Response-Time', `${responseTime}ms`);
  
  return response;
} 