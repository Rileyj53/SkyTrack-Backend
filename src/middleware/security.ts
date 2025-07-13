import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TokenPayload } from '@/lib/jwt';
import { validateAPIKey } from '@/lib/apiKeys';
import { validateCSRFToken } from '@/lib/csrf';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { School } from '@/models/School';
import { ApiKey } from '@/models/ApiKey';
import mongoose from 'mongoose';
import crypto from 'crypto';

// Advanced security configuration
export interface SecurityConfig {
  requireAuth?: boolean;
  requireApiKey?: boolean;
  requireCSRF?: boolean;
  allowedRoles?: string[];
  requireSchoolAccess?: boolean;
  allowedMethods?: string[];
  rateLimiting?: {
    maxRequests: number;
    windowMs: number;
    slidingWindow?: boolean;
  };
  // Advanced security features
  requireRequestSigning?: boolean;
  enableFraudDetection?: boolean;
  enableGeoBlocking?: boolean;
  allowedCountries?: string[];
  requireTwoFactor?: boolean;
  enableAdvancedAudit?: boolean;
  pciCompliance?: boolean;
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  maxRequestSize?: number; // in bytes
  requireHttpsOnly?: boolean;
  sessionTimeout?: number; // in minutes
}

// Extended request interface with security context
export interface SecureRequest extends NextRequest {
  user?: any;
  apiKey?: any;
  schoolId?: string;
  permissions?: string[];
}

// Security context for the request
export interface SecurityContext {
  user: any | null;
  apiKey: any | null;
  isAuthenticated: boolean;
  permissions: string[];
  schoolId: string | null;
  // Advanced security context
  riskScore: number;
  sessionId: string;
  clientFingerprint: string;
  geoLocation?: {
    country: string;
    region: string;
    city: string;
  };
  fraudFlags: string[];
  auditId: string;
  encryptionLevel: string;
}

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number; requests: number[] }>();

// Session store (in production, use Redis)
const sessionStore = new Map<string, { userId: string; createdAt: number; lastActivity: number }>();

// Fraud detection patterns
const FRAUD_PATTERNS = {
  RAPID_REQUESTS: { threshold: 100, window: 60000 }, // 100 requests in 1 minute
  MULTIPLE_IPS: { threshold: 5, window: 3600000 }, // 5 different IPs in 1 hour
  UNUSUAL_HOURS: { startHour: 2, endHour: 6 }, // Activity between 2-6 AM
  SUSPICIOUS_USER_AGENTS: [
    'bot', 'crawler', 'spider', 'scraper', 'scanner'
  ],
  VELOCITY_CHECKS: { threshold: 10, window: 300000 } // 10 transactions in 5 minutes
};

// Geo-blocking: High-risk countries (you can customize this list)
const HIGH_RISK_COUNTRIES = [
  'CN', 'RU', 'KP', 'IR', 'SY', 'MM', 'AF'
];

// Role hierarchy for permission checks
const ROLE_HIERARCHY = {
  'sys_admin': 4,
  'school_admin': 3,
  'instructor': 2,
  'student': 1
} as const;

// Permission matrix by role with advanced permissions
const ROLE_PERMISSIONS = {
  'sys_admin': ['*'], // All permissions
  'school_admin': ['school:read', 'school:write', 'user:read', 'user:write', 'student:*', 'instructor:*', 'plane:*', 'payment:read', 'payment:write'],
  'instructor': ['school:read', 'user:read', 'student:read', 'plane:read', 'flight:*', 'payment:read:own'],
  'student': ['school:read', 'user:read:own', 'student:read:own', 'flight:read:own', 'payment:read:own']
} as const;

/**
 * Main enterprise security middleware factory
 */
export function withSecurity(config: SecurityConfig = {}) {
  return async (request: NextRequest, context?: { params?: any }): Promise<{
    response?: NextResponse;
    securityContext?: SecurityContext;
  }> => {
    const auditId = generateAuditId();
    const startTime = Date.now();
    
    try {
      await connectDB();

      // Initialize security context with advanced features
      const securityContext: SecurityContext = {
        user: null,
        apiKey: null,
        isAuthenticated: false,
        permissions: [],
        schoolId: null,
        riskScore: 0,
        sessionId: '',
        clientFingerprint: '',
        fraudFlags: [],
        auditId,
        encryptionLevel: 'AES-256'
      };

      // Enterprise security: HTTPS enforcement
      if (config.requireHttpsOnly && !request.url.startsWith('https://')) {
        await logSecurityEvent('HTTPS_VIOLATION', { auditId, url: request.url });
        return {
          response: NextResponse.json(
            { error: 'HTTPS required for secure operations' },
            { status: 400 }
          )
        };
      }

      // Enterprise security: Request size validation
      if (config.maxRequestSize) {
        const contentLength = parseInt(request.headers.get('content-length') || '0');
        if (contentLength > config.maxRequestSize) {
          await logSecurityEvent('REQUEST_SIZE_VIOLATION', { auditId, size: contentLength, maxAllowed: config.maxRequestSize });
          return {
            response: NextResponse.json(
              { error: 'Request too large' },
              { status: 413 }
            )
          };
        }
      }

      // Enterprise security: Client fingerprinting
      securityContext.clientFingerprint = generateClientFingerprint(request);

      // Enterprise security: Advanced rate limiting with sliding window
      const rateLimitResult = await advancedRateLimit(request, config.rateLimiting);
      if (rateLimitResult.blocked) {
        securityContext.fraudFlags.push('RATE_LIMIT_EXCEEDED');
        await logSecurityEvent('RATE_LIMIT_VIOLATION', { auditId, ip: getClientIP(request) });
        return { response: rateLimitResult.response };
      }

      // Enterprise security: Geo-blocking
      if (config.enableGeoBlocking) {
        const geoResult = await checkGeoLocation(request, config.allowedCountries);
        if (geoResult.blocked) {
          securityContext.fraudFlags.push('GEO_BLOCKED');
          await logSecurityEvent('GEO_BLOCK_VIOLATION', { auditId, country: geoResult.country, ip: getClientIP(request) });
          return { response: geoResult.response };
        }
        securityContext.geoLocation = geoResult.location;
      }

      // Enterprise security: Fraud detection
      if (config.enableFraudDetection) {
        const fraudResult = await detectFraud(request, securityContext);
        securityContext.riskScore = fraudResult.riskScore;
        securityContext.fraudFlags.push(...fraudResult.flags);
        
        if (fraudResult.riskScore > 80) {
          await logSecurityEvent('HIGH_RISK_DETECTED', { auditId, riskScore: fraudResult.riskScore, flags: fraudResult.flags });
          return {
            response: NextResponse.json(
              { error: 'Request blocked due to security policy' },
              { status: 403 }
            )
          };
        }
      }

      // Enterprise security: Request signature verification
      if (config.requireRequestSigning) {
        const signatureResult = await verifyRequestSignature(request);
        if (!signatureResult.valid) {
          securityContext.fraudFlags.push('INVALID_SIGNATURE');
          await logSecurityEvent('SIGNATURE_VERIFICATION_FAILED', { auditId, reason: signatureResult.reason });
          return {
            response: NextResponse.json(
              { error: 'Invalid request signature' },
              { status: 401 }
            )
          };
        }
      }

      // Method validation
      if (config.allowedMethods && !config.allowedMethods.includes(request.method)) {
        return {
          response: NextResponse.json(
            { error: 'Method not allowed' },
            { status: 405 }
          )
        };
      }

      // CSRF Protection
      if (config.requireCSRF && !isCSRFExempt(request)) {
        const csrfResult = await validateCSRF(request);
        if (csrfResult.error) {
          return { response: csrfResult.error };
        }
      }

      // API Key Authentication
      if (config.requireApiKey) {
        const apiKeyResult = await authenticateApiKey(request);
        if (apiKeyResult.error) {
          return { response: apiKeyResult.error };
        }
        securityContext.apiKey = apiKeyResult.apiKey;
        securityContext.user = apiKeyResult.user;
        securityContext.isAuthenticated = true;
      }

      // JWT Authentication with session management
      if (config.requireAuth || config.allowedRoles) {
        const authResult = await authenticateJWT(request, config);
        if (authResult.error) {
          return { response: authResult.error };
        }
        securityContext.user = authResult.user;
        securityContext.sessionId = authResult.sessionId || '';
        securityContext.isAuthenticated = true;
      }

      // Enterprise security: Two-factor authentication check
      if (config.requireTwoFactor && securityContext.user && !securityContext.user.mfaVerified) {
        await logSecurityEvent('MFA_REQUIRED', { auditId, userId: securityContext.user._id });
        return {
          response: NextResponse.json(
            { error: 'Two-factor authentication required' },
            { status: 428 } // Precondition Required
          )
        };
      }

      // Role-based access control
      if (config.allowedRoles && securityContext.user) {
        if (!config.allowedRoles.includes(securityContext.user.role)) {
          return {
            response: NextResponse.json(
              { error: 'Insufficient permissions' },
              { status: 403 }
            )
          };
        }
      }

      // School access control
      if (config.requireSchoolAccess && context?.params?.schoolId) {
        const schoolAccessResult = await validateSchoolAccess(
          securityContext.user,
          context.params.schoolId
        );
        if (schoolAccessResult.error) {
          return { response: schoolAccessResult.error };
        }
        securityContext.schoolId = context.params.schoolId;
      }

      // Set user permissions
      if (securityContext.user) {
        securityContext.permissions = getUserPermissions(securityContext.user.role);
      }

      // Enterprise security: Advanced audit logging
      if (config.enableAdvancedAudit) {
        await logAdvancedAudit(request, securityContext, startTime);
      }

      return { securityContext };
    } catch (error) {
      console.error('Security middleware error:', error);
      await logSecurityEvent('SECURITY_MIDDLEWARE_ERROR', { auditId, error: error.message });
      return {
        response: NextResponse.json(
          { error: 'Security validation failed' },
          { status: 500 }
        )
      };
    }
  };
}

/**
 * Advanced rate limiting with sliding window
 */
async function advancedRateLimit(request: NextRequest, config?: SecurityConfig['rateLimiting']): Promise<{
  blocked: boolean;
  response?: NextResponse;
}> {
  if (!config) return { blocked: false };

  const clientId = getClientIP(request) + ':' + (request.headers.get('user-agent') || '');
  const now = Date.now();
  const windowMs = config.windowMs || 60000;
  const maxRequests = config.maxRequests || 100;

  let clientData = rateLimitStore.get(clientId) || { count: 0, resetTime: now + windowMs, requests: [] };

  if (config.slidingWindow) {
    // Sliding window implementation
    clientData.requests = clientData.requests.filter(time => now - time < windowMs);
    clientData.requests.push(now);
    
    if (clientData.requests.length > maxRequests) {
      return {
        blocked: true,
        response: NextResponse.json(
          { error: 'Rate limit exceeded', retryAfter: Math.ceil(windowMs / 1000) },
          { status: 429, headers: { 'Retry-After': Math.ceil(windowMs / 1000).toString() } }
        )
      };
    }
  } else {
    // Fixed window implementation
    if (now > clientData.resetTime) {
      clientData = { count: 1, resetTime: now + windowMs, requests: [now] };
    } else {
      clientData.count++;
      if (clientData.count > maxRequests) {
        return {
          blocked: true,
          response: NextResponse.json(
            { error: 'Rate limit exceeded', retryAfter: Math.ceil((clientData.resetTime - now) / 1000) },
            { status: 429, headers: { 'Retry-After': Math.ceil((clientData.resetTime - now) / 1000).toString() } }
          )
        };
      }
    }
  }

  rateLimitStore.set(clientId, clientData);
  return { blocked: false };
}

/**
 * Geo-blocking implementation
 */
async function checkGeoLocation(request: NextRequest, allowedCountries?: string[]): Promise<{
  blocked: boolean;
  response?: NextResponse;
  country?: string;
  location?: SecurityContext['geoLocation'];
}> {
  const clientIP = getClientIP(request);
  
  // In production, use a real IP geolocation service like MaxMind
  const mockGeoData = await getMockGeoLocation(clientIP);
  
  if (HIGH_RISK_COUNTRIES.includes(mockGeoData.country)) {
    return {
      blocked: true,
      country: mockGeoData.country,
      response: NextResponse.json(
        { error: 'Access denied from this location' },
        { status: 403 }
      )
    };
  }

  if (allowedCountries && !allowedCountries.includes(mockGeoData.country)) {
    return {
      blocked: true,
      country: mockGeoData.country,
      response: NextResponse.json(
        { error: 'Access restricted to specific regions' },
        { status: 403 }
      )
    };
  }

  return {
    blocked: false,
    country: mockGeoData.country,
    location: mockGeoData
  };
}

/**
 * Advanced fraud detection system
 */
async function detectFraud(request: NextRequest, context: SecurityContext): Promise<{
  riskScore: number;
  flags: string[];
}> {
  let riskScore = 0;
  const flags: string[] = [];
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  // Check for suspicious user agents
  if (FRAUD_PATTERNS.SUSPICIOUS_USER_AGENTS.some(pattern => 
    userAgent.toLowerCase().includes(pattern))) {
    riskScore += 30;
    flags.push('SUSPICIOUS_USER_AGENT');
  }

  // Check for unusual timing patterns
  const hour = new Date().getHours();
  if (hour >= FRAUD_PATTERNS.UNUSUAL_HOURS.startHour && 
      hour <= FRAUD_PATTERNS.UNUSUAL_HOURS.endHour) {
    riskScore += 15;
    flags.push('UNUSUAL_HOURS');
  }

  // Check request velocity
  const velocityKey = `velocity:${clientIP}`;
  const velocityData = rateLimitStore.get(velocityKey);
  if (velocityData && velocityData.requests.length > FRAUD_PATTERNS.VELOCITY_CHECKS.threshold) {
    riskScore += 40;
    flags.push('HIGH_VELOCITY');
  }

  // Check for missing security headers
  if (!request.headers.get('sec-fetch-site')) {
    riskScore += 10;
    flags.push('MISSING_SECURITY_HEADERS');
  }

  return { riskScore, flags };
}

/**
 * Request signature verification
 */
async function verifyRequestSignature(request: NextRequest): Promise<{
  valid: boolean;
  reason?: string;
}> {
  const signature = request.headers.get('X-Signature');
  const timestamp = request.headers.get('X-Timestamp');
  const nonce = request.headers.get('X-Nonce');

  if (!signature || !timestamp || !nonce) {
    return { valid: false, reason: 'Missing signature headers' };
  }

  // Check timestamp freshness (5 minute window)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 300000) {
    return { valid: false, reason: 'Request timestamp too old' };
  }

  // In production, verify signature against secret key
  // This is a simplified example
  const expectedSignature = await generateRequestSignature(request, timestamp, nonce);
  if (signature !== expectedSignature) {
    return { valid: false, reason: 'Invalid signature' };
  }

  return { valid: true };
}

/**
 * JWT Authentication with enhanced session management
 */
async function authenticateJWT(request: NextRequest, config: SecurityConfig): Promise<{
  user?: any;
  sessionId?: string;
  error?: NextResponse;
}> {
  try {
    // Get token from Authorization header or cookies
    let token = request.headers.get('Authorization')?.split(' ')[1];
    
    if (!token) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = parseCookies(cookieHeader);
        token = cookies['token'] || cookies['jwt'] || cookies['auth-token'];
      }
    }

    if (!token) {
      return {
        error: NextResponse.json(
          { error: 'Authentication token required' },
          { status: 401 }
        )
      };
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return {
        error: NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        )
      };
    }

    // Get full user data from database
    const user = await User.findById(decoded.userId);
    if (!user) {
      return {
        error: NextResponse.json(
          { error: 'User not found' },
          { status: 401 }
        )
      };
    }

    // Enterprise security: Session management
    const sessionId = generateSessionId();
    const sessionTimeout = config.sessionTimeout || 30; // 30 minutes default
    
    // Check for existing active sessions
    const existingSession = Array.from(sessionStore.entries())
      .find(([_, session]) => session.userId === user._id.toString());
    
    if (existingSession) {
      const [existingSessionId, sessionData] = existingSession;
      const timeSinceActivity = Date.now() - sessionData.lastActivity;
      
      if (timeSinceActivity > sessionTimeout * 60 * 1000) {
        sessionStore.delete(existingSessionId);
      } else {
        // Update last activity
        sessionData.lastActivity = Date.now();
        sessionStore.set(existingSessionId, sessionData);
        return { user, sessionId: existingSessionId };
      }
    }

    // Create new session
    sessionStore.set(sessionId, {
      userId: user._id.toString(),
      createdAt: Date.now(),
      lastActivity: Date.now()
    });

    return { user, sessionId };
  } catch (error) {
    console.error('JWT authentication error:', error);
    return {
      error: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    };
  }
}

/**
 * API Key Authentication
 */
async function authenticateApiKey(request: NextRequest): Promise<{
  apiKey?: any;
  user?: any;
  error?: NextResponse;
}> {
  try {
    const apiKeyHeader = request.headers.get('X-API-Key');
    if (!apiKeyHeader) {
      return {
        error: NextResponse.json(
          { error: 'API key required' },
          { status: 401 }
        )
      };
    }

    // Hash the incoming API key
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKeyHeader);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Find API key in database
    const apiKeyDoc = await ApiKey.findOne({ 
      key: hashedKey,
      isActive: true
    });

    if (!apiKeyDoc) {
      return {
        error: NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        )
      };
    }

    // Check expiration
    if (apiKeyDoc.expiresAt && new Date() > new Date(apiKeyDoc.expiresAt)) {
      return {
        error: NextResponse.json(
          { error: 'API key expired' },
          { status: 401 }
        )
      };
    }

    // Get associated user
    const user = await User.findById(apiKeyDoc.user);
    if (!user) {
      return {
        error: NextResponse.json(
          { error: 'Associated user not found' },
          { status: 401 }
        )
      };
    }

    // Update last used timestamp
    await ApiKey.updateOne(
      { _id: apiKeyDoc._id },
      { $set: { lastUsedAt: new Date() } }
    );

    return { apiKey: apiKeyDoc, user };
  } catch (error) {
    console.error('API key authentication error:', error);
    return {
      error: NextResponse.json(
        { error: 'API key validation failed' },
        { status: 401 }
      )
    };
  }
}

/**
 * CSRF Validation with enhanced debugging
 */
async function validateCSRF(request: NextRequest): Promise<{
  error?: NextResponse;
}> {
  try {
    // Get CSRF token from header
    const csrfToken = request.headers.get('X-CSRF-Token');
    
    console.log(JSON.stringify({
      level: 'DEBUG',
      message: 'CSRF validation debug',
      timestamp: new Date().toISOString(),
      hasCSRFHeader: !!csrfToken,
      csrfTokenLength: csrfToken?.length || 0,
      csrfTokenPreview: csrfToken ? csrfToken.substring(0, 10) + '...' : 'missing',
      allHeaders: Object.fromEntries(request.headers.entries()),
      url: request.url,
      method: request.method
    }));
    
    if (!csrfToken) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'CSRF token missing from header',
        timestamp: new Date().toISOString(),
        url: request.url,
        method: request.method
      }));
      
      return {
        error: NextResponse.json(
          { error: 'CSRF token required' },
          { status: 403 }
        )
      };
    }

    // Get stored token from cookies with multiple parsing methods
    let storedToken: string | undefined;
    
    // Method 1: Use request.cookies.get() - Next.js built-in
    const cookieFromNextJS = request.cookies.get('csrf-token')?.value;
    
    // Method 2: Parse cookie header manually for comparison
    const cookieHeader = request.headers.get('cookie');
    let cookieFromHeader: string | undefined;
    
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader);
      cookieFromHeader = cookies['csrf-token'];
    }
    
    // Use the first available method
    storedToken = cookieFromNextJS || cookieFromHeader;
    
    console.log(JSON.stringify({
      level: 'DEBUG',
      message: 'CSRF cookie parsing debug',
      timestamp: new Date().toISOString(),
      cookieFromNextJS: cookieFromNextJS ? cookieFromNextJS.substring(0, 10) + '...' : 'missing',
      cookieFromHeader: cookieFromHeader ? cookieFromHeader.substring(0, 10) + '...' : 'missing',
      storedToken: storedToken ? storedToken.substring(0, 10) + '...' : 'missing',
      cookieHeader: cookieHeader ? cookieHeader.substring(0, 100) + '...' : 'missing',
      cookieHeaderLength: cookieHeader?.length || 0,
      url: request.url,
      method: request.method
    }));
    
    if (!storedToken) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'CSRF token not found in cookies',
        timestamp: new Date().toISOString(),
        cookieHeader: cookieHeader ? cookieHeader.substring(0, 100) + '...' : 'missing',
        parsedCookies: cookieHeader ? Object.keys(parseCookies(cookieHeader)) : [],
        url: request.url,
        method: request.method
      }));
      
      return {
        error: NextResponse.json(
          { error: 'CSRF token not found' },
          { status: 403 }
        )
      };
    }

    // Clean tokens to remove any whitespace or hidden characters
    const cleanHeaderToken = csrfToken.trim();
    const cleanStoredToken = storedToken.trim();
    
    console.log(JSON.stringify({
      level: 'DEBUG',
      message: 'CSRF token comparison debug',
      timestamp: new Date().toISOString(),
      headerToken: cleanHeaderToken.substring(0, 10) + '...',
      storedToken: cleanStoredToken.substring(0, 10) + '...',
      headerTokenLength: cleanHeaderToken.length,
      storedTokenLength: cleanStoredToken.length,
      tokensEqual: cleanHeaderToken === cleanStoredToken,
      url: request.url,
      method: request.method
    }));

    // Validate the tokens
    const isValid = validateCSRFToken(cleanHeaderToken, cleanStoredToken);
    
    if (!isValid) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'CSRF token validation failed',
        timestamp: new Date().toISOString(),
        headerToken: cleanHeaderToken.substring(0, 10) + '...',
        storedToken: cleanStoredToken.substring(0, 10) + '...',
        headerTokenLength: cleanHeaderToken.length,
        storedTokenLength: cleanStoredToken.length,
        tokensEqual: cleanHeaderToken === cleanStoredToken,
        url: request.url,
        method: request.method
      }));
      
      return {
        error: NextResponse.json(
          { error: 'Invalid CSRF token' },
          { status: 403 }
        )
      };
    }

    console.log(JSON.stringify({
      level: 'DEBUG',
      message: 'CSRF validation successful',
      timestamp: new Date().toISOString(),
      url: request.url,
      method: request.method
    }));

    return {};
  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'CSRF validation error',
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method
    }));
    
    return {
      error: NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      )
    };
  }
}

/**
 * School Access Validation
 */
async function validateSchoolAccess(user: any, schoolId: string): Promise<{
  error?: NextResponse;
}> {
  try {
    // System admins have access to all schools
    if (user.role === 'sys_admin') {
      return {};
    }

    // Check if user has school_id and it matches
    if (!user.school_id) {
      return {
        error: NextResponse.json(
          { error: 'User not assigned to any school' },
          { status: 403 }
        )
      };
    }

    if (user.school_id.toString() !== schoolId) {
      return {
        error: NextResponse.json(
          { error: 'Access denied to this school' },
          { status: 403 }
        )
      };
    }

    // Verify school exists
    const school = await School.findById(schoolId);
    if (!school) {
      return {
        error: NextResponse.json(
          { error: 'School not found' },
          { status: 404 }
        )
      };
    }

    return {};
  } catch (error) {
    console.error('School access validation error:', error);
    return {
      error: NextResponse.json(
        { error: 'School access validation failed' },
        { status: 500 }
      )
    };
  }
}

/**
 * Advanced security utility functions
 */
function generateAuditId(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateClientFingerprint(request: NextRequest): string {
  const components = [
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
    request.headers.get('accept-encoding') || '',
    getClientIP(request)
  ];
  
  return crypto.createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
}

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] ||
         request.headers.get('x-real-ip') ||
         request.headers.get('cf-connecting-ip') ||
         '127.0.0.1';
}

async function getMockGeoLocation(ip: string): Promise<SecurityContext['geoLocation']> {
  // In production, use a real geolocation service
  return {
    country: 'US',
    region: 'CA',
    city: 'San Francisco'
  };
}

async function generateRequestSignature(request: NextRequest, timestamp: string, nonce: string): Promise<string> {
  // In production, use your actual signing secret
  const secret = process.env.REQUEST_SIGNING_SECRET || 'default-secret';
  const method = request.method;
  const url = request.url;
  
  const stringToSign = `${method}|${url}|${timestamp}|${nonce}`;
  return crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');
}

async function logSecurityEvent(eventType: string, data: any): Promise<void> {
  // In production, log to secure audit system
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    eventType,
    level: 'SECURITY',
    ...data
  }));
}

async function logAdvancedAudit(request: NextRequest, context: SecurityContext, startTime: number): Promise<void> {
  const auditData = {
    auditId: context.auditId,
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('user-agent'),
    clientIP: getClientIP(request),
    userId: context.user?._id,
    sessionId: context.sessionId,
    riskScore: context.riskScore,
    fraudFlags: context.fraudFlags,
    geoLocation: context.geoLocation,
    processingTimeMs: Date.now() - startTime,
    encryptionLevel: context.encryptionLevel
  };

  // In production, send to secure audit log
  console.log('AUDIT:', JSON.stringify(auditData));
}

/**
 * Permission Utilities (enhanced with advanced permissions)
 */
export function hasPermission(userRole: string, requiredPermission: string, resourceOwner?: string, userId?: string): boolean {
  const userPermissions = getUserPermissions(userRole);
  
  // Check for wildcard permission
  if (userPermissions.includes('*')) {
    return true;
  }

  // Check for exact permission match
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check for resource-specific permissions (e.g., "user:read:own")
  if (requiredPermission.endsWith(':own') && resourceOwner === userId) {
    const basePermission = requiredPermission.replace(':own', '');
    return userPermissions.includes(basePermission + ':own');
  }

  return false;
}

export function hasRoleAccess(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole as keyof typeof ROLE_HIERARCHY] || 0;
  
  return userLevel >= requiredLevel;
}

function getUserPermissions(role: string): string[] {
  const permissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
  return permissions ? [...permissions] : [];
}

/**
 * Utility Functions
 */
function isCSRFExempt(request: NextRequest): boolean {
  const exemptPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/csrf-token',
    '/api/health'
  ];
  
  const exemptMethods = ['GET', 'HEAD', 'OPTIONS'];
  
  return exemptPaths.some(path => request.nextUrl.pathname.startsWith(path)) ||
         exemptMethods.includes(request.method);
}

function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    acc[name] = value;
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Higher-order function for API route protection with enterprise security
 */
export function secureApiRoute(
  handler: (request: NextRequest, context: { params?: any; securityContext: SecurityContext }) => Promise<NextResponse>,
  config: SecurityConfig
) {
  return async (request: NextRequest, context?: { params?: any }) => {
    const securityResult = await withSecurity(config)(request, context);
    
    if (securityResult.response) {
      return securityResult.response;
    }
    
    return handler(request, { 
      ...context, 
      securityContext: securityResult.securityContext! 
    });
  };
}

/**
 * Data sanitization for sensitive information
 */
export function sanitizeData(data: any, classification: SecurityConfig['dataClassification'] = 'internal'): any {
  if (!data || typeof data !== 'object') return data;

  const sanitized = { ...data };
  
  // Remove sensitive fields based on classification
  const sensitiveFields = {
    'restricted': ['password', 'ssn', 'creditCard', 'bankAccount', 'apiKey', 'secret'],
    'confidential': ['password', 'apiKey', 'secret', 'token'],
    'internal': ['password', 'apiKey'],
    'public': ['password']
  };

  const fieldsToRemove = sensitiveFields[classification] || sensitiveFields['internal'];
  
  fieldsToRemove.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * PCI compliance utilities
 */
export function maskCardNumber(cardNumber: string): string {
  if (!cardNumber || cardNumber.length < 4) return cardNumber;
  return '*'.repeat(cardNumber.length - 4) + cardNumber.slice(-4);
}

export function validatePCICompliance(data: any): { compliant: boolean; violations: string[] } {
  const violations: string[] = [];
  
  // Check for unencrypted card data
  if (data.creditCard && !data.encrypted) {
    violations.push('Unencrypted credit card data');
  }
  
  // Check for stored CVV
  if (data.cvv) {
    violations.push('CVV storage is prohibited');
  }
  
  // Check for full PAN storage
  if (data.cardNumber && data.cardNumber.length > 6) {
    violations.push('Full PAN storage requires encryption');
  }
  
  return {
    compliant: violations.length === 0,
    violations
  };
} 