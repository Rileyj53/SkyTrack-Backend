import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { generateToken } from '@/lib/jwt';
import { hashPassword } from '@/lib/auth';
import { generateCSRFToken } from '@/lib/csrf';

// Enhanced password validation function
function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const minLength = 8;
  const maxLength = 128;

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (password.length > maxLength) {
    errors.push(`Password must be no more than ${maxLength} characters long`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  // Check for common weak patterns
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password cannot contain more than 2 consecutive identical characters');
  }
  if (/123|abc|qwe/i.test(password)) {
    errors.push('Password cannot contain common sequential patterns');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Email validation function
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Security configuration for user registration endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: false, // Not required for registration
  requireApiKey: true, // API key still required to prevent abuse
  requireCSRF: false, // Not required for initial registration
  enableFraudDetection: true, // Critical to prevent registration abuse
  enableAdvancedAudit: true, // Track all registration attempts
  dataClassification: 'confidential', // Contains personal information
  rateLimiting: {
    maxRequests: process.env.NODE_ENV === 'development' ? 100 : 5, // More lenient for development
    windowMs: process.env.NODE_ENV === 'development' ? 60000 : 300000, // 1 minute in dev, 5 minutes in prod
    slidingWindow: true
  },
  maxRequestSize: 1024 * 4 // 4KB max for registration requests
};

export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Structured logging for Vercel
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'User registration request initiated',
    auditId: securityContext.auditId,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'POST /api/auth/register'
  }));

  // Check risk score - block high-risk registration attempts
  if (securityContext.riskScore > 75) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk registration attempt blocked',
      auditId: securityContext.auditId,
      riskScore: securityContext.riskScore,
      fraudFlags: securityContext.fraudFlags,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Registration blocked due to security policy',
        code: 'HIGH_RISK_REGISTRATION',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      },
      securityContext: {
        riskScore: securityContext.riskScore,
        fraudFlags: securityContext.fraudFlags
      }
    }, { status: 403 });
  }

  // Establish database connection with retry logic
  await connectDB();

  const { 
    email, 
    password, 
    first_name, 
    last_name, 
    role = 'student', 
    organization_id, 
    student_id, 
    instructor_id 
  } = await request.json();

  // Comprehensive input validation
  const validationErrors: string[] = [];

  // Validate required fields
  if (!email) {
    validationErrors.push('Email is required');
  } else if (!validateEmail(email)) {
    validationErrors.push('Invalid email format');
  }

  if (!password) {
    validationErrors.push('Password is required');
  } else {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      validationErrors.push(...passwordValidation.errors);
    }
  }

  if (!first_name || first_name.trim().length === 0) {
    validationErrors.push('First name is required');
  } else if (first_name.length > 50) {
    validationErrors.push('First name must be 50 characters or less');
  }

  if (!last_name || last_name.trim().length === 0) {
    validationErrors.push('Last name is required');
  } else if (last_name.length > 50) {
    validationErrors.push('Last name must be 50 characters or less');
  }

  // Validate role
  const validRoles = ['sys_admin', 'school_admin', 'instructor', 'student', 'mechanic', 'member'];
  if (!validRoles.includes(role)) {
    validationErrors.push('Invalid role specified');
  }

  // Return validation errors if any
  if (validationErrors.length > 0) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Registration attempt with validation errors',
      auditId: securityContext.auditId,
      email: email,
      validationErrors: validationErrors,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors,
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Registration attempt with existing email',
        auditId: securityContext.auditId,
        email: email,
        existingUserId: existingUser._id.toString(),
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'User already exists',
          code: 'USER_EXISTS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 409 });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Hashing password for registration',
      auditId: securityContext.auditId,
      email: email,
      timestamp: new Date().toISOString()
    }));

    // Hash password
    const hashedPassword = await hashPassword(password);

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Password hashed successfully, creating user',
      auditId: securityContext.auditId,
      email: email,
      role: role,
      hasOrganizationId: !!organization_id,
      hasStudentId: !!student_id,
      hasInstructorId: !!instructor_id,
      timestamp: new Date().toISOString()
    }));

    // Create user data object with enhanced security defaults
    const userData = {
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      role,
      organization_id: organization_id || null,
      student_id: student_id || null,
      instructor_id: instructor_id || null,
      isActive: true,
      failedLoginAttempts: 0,
      mfaEnabled: false,
      mfaVerified: false,
      mfaBackupCodes: [],
      emailVerified: true, // In production, set to false and send verification email
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create new user
    const user = await User.create(userData);

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'User created successfully, generating tokens',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      timestamp: new Date().toISOString()
    }));

    // Generate JWT token
    const token = await generateToken(user);

    // Generate CSRF token
    const csrfToken = generateCSRFToken();

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'User registration completed successfully',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    // Create response with enhanced security information
    const response = NextResponse.json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          organization_id: user.organization_id,
          student_id: user.student_id,
          instructor_id: user.instructor_id,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          mfaEnabled: user.mfaEnabled
        },
        token,
        csrfToken: csrfToken.token
      },
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      securityContext: {
        sessionId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'AES-256'
      }
    });

    // Set HTTP-only cookie with JWT token
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    // Set CSRF token cookie
    response.cookies.set('csrf-token', csrfToken.token, {
      httpOnly: false, // Allow JavaScript to read this cookie
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: Math.floor((csrfToken.expires - Date.now()) / 1000)
    });

    return response;

  } catch (dbError) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Database error during user registration',
      auditId: securityContext.auditId,
      email: email,
      error: dbError.message,
      timestamp: new Date().toISOString()
    }));

    // Check for specific database errors
    if (dbError.code === 11000) {
      // Duplicate key error
      return NextResponse.json({
        error: {
          message: 'User already exists',
          code: 'DUPLICATE_USER',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 409 });
    }

    return NextResponse.json({
      error: {
        message: 'Registration failed. Please try again.',
        code: 'DATABASE_ERROR',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}, SECURITY_CONFIG); 