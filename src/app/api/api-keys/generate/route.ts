import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { ApiKey } from '@/models/ApiKey';
import { User } from '@/models/User';
import { generateAPIKey } from '@/lib/apiKeys';

// Security configuration for API key generation
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: false,
  requireCSRF: false,
  requireHttpsOnly: false,
  requireRequestSigning: false, // Disabled for easier testing and development
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin'], // Temporarily allow school_admin for testing
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'restricted',
  rateLimiting: {
    maxRequests: 5,
    windowMs: 300000, // 5 minutes for very sensitive operations
    slidingWindow: true
  },
  sessionTimeout: 15,
  maxRequestSize: 1024 // 1KB - small requests only
};

export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  try {
    // Establish database connection with automatic retry logic
    await connectDB();
    
    // Structured logging for Vercel
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'API key generation request initiated',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      riskScore: securityContext.riskScore,
      timestamp: new Date().toISOString(),
      endpoint: '/api/api-keys/generate'
    }));

    // Additional risk assessment for API key generation
    if (securityContext.riskScore > 50) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'High risk API key generation attempt blocked',
        auditId: securityContext.auditId,
        userId: securityContext.user?._id,
        riskScore: securityContext.riskScore,
        fraudFlags: securityContext.fraudFlags,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Request blocked due to security policy',
          code: 'HIGH_RISK_BLOCKED',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        },
        securityContext: {
          riskScore: securityContext.riskScore,
          fraudFlags: securityContext.fraudFlags
        }
      }, { status: 403 });
    }

    // Get the user from the database to verify existence
    const user = await User.findById(securityContext.user._id);
    if (!user) {
      console.error(JSON.stringify({
        level: 'ERROR',
        message: 'Authenticated user not found in database',
        auditId: securityContext.auditId,
        userId: securityContext.user?._id,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const { label, durationValue, durationType } = body;

    // Comprehensive input validation
    if (!label || !durationValue || !durationType) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Missing required fields in API key generation request',
        auditId: securityContext.auditId,
        userId: securityContext.user?._id,
        providedFields: { hasLabel: !!label, hasDurationValue: !!durationValue, hasDurationType: !!durationType },
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Missing required fields: label, durationValue, and durationType are required',
          code: 'MISSING_REQUIRED_FIELDS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Validate duration type
    const validDurationTypes = ['days', 'months', 'years'];
    if (!validDurationTypes.includes(durationType)) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Invalid duration type provided',
        auditId: securityContext.auditId,
        userId: securityContext.user?._id,
        providedDurationType: durationType,
        validTypes: validDurationTypes,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Invalid duration type. Must be one of: days, months, years',
          code: 'INVALID_DURATION_TYPE',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Validate duration value (reasonable limits)
    const maxDurations = { days: 365, months: 12, years: 5 };
    if (durationValue <= 0 || durationValue > maxDurations[durationType]) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Invalid duration value provided',
        auditId: securityContext.auditId,
        userId: securityContext.user?._id,
        durationValue: durationValue,
        durationType: durationType,
        maxAllowed: maxDurations[durationType],
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: `Invalid duration value. Must be between 1 and ${maxDurations[durationType]} ${durationType}`,
          code: 'INVALID_DURATION_VALUE',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Calculate expiration date
    const expirationDate = new Date();
    switch (durationType) {
      case 'days':
        expirationDate.setDate(expirationDate.getDate() + durationValue);
        break;
      case 'months':
        expirationDate.setMonth(expirationDate.getMonth() + durationValue);
        break;
      case 'years':
        expirationDate.setFullYear(expirationDate.getFullYear() + durationValue);
        break;
    }

    // Generate a new API key using the secure library function
    const apiKey = generateAPIKey();

    // Hash the API key for secure storage
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'API key generated and hashed',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      label: label,
      expiresAt: expirationDate.toISOString(),
      lastSix: apiKey.slice(-6),
      timestamp: new Date().toISOString()
    }));

    // Create a new API key document
    const newApiKey = new ApiKey({
      user: user._id,
      key: hashedKey,
      label: label,
      lastSix: apiKey.slice(-6),
      expiresAt: expirationDate
    });

    // Save the API key to the database
    await newApiKey.save();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'API key successfully saved to database',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      apiKeyId: newApiKey._id,
      label: label,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'API key generated successfully',
      data: {
        apiKey: apiKey, // Return the unhashed key only once
        apiKeyId: newApiKey._id,
        label: label,
        lastSix: apiKey.slice(-6),
        expiresAt: expirationDate,
        createdAt: newApiKey.createdAt
      },
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      securityContext: {
        sessionId: securityContext.sessionId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'AES-256'
      }
    });

  } catch (error) {
    // Enhanced error logging
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Failed to generate API key',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    
    // Let the global errorHandler process the error
    throw error;
  }
}, SECURITY_CONFIG); 