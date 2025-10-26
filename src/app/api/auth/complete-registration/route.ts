import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import Student from '@/models/Student';
import Instructor from '@/models/Instructor';
import { encryptSecure } from '@/lib/encryption';
import { generateToken } from '@/lib/jwt';
import { sanitizeData } from '@/middleware/security';
import { validatePassword } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// Security configuration for registration endpoint
const REGISTRATION_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: false, // No auth required for registration
  requireApiKey: true, // Still require API key to prevent abuse
  requireCSRF: true, // CSRF protection for POST requests
  enableFraudDetection: true, // Detect suspicious registration attempts
  enableAdvancedAudit: true, // Enhanced logging for security events
  dataClassification: 'confidential', // Registration data is confidential
  rateLimiting: {
    maxRequests: 10, // Limit registration attempts
    windowMs: 60000, // 1 minute window
    slidingWindow: true
  },
  maxRequestSize: 10 * 1024, // 10KB max request size
  sessionTimeout: 30 // 30 minute session for registration process
};

// POST /api/auth/complete-registration - Complete student/instructor registration
export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Registration request received',
      auditId: securityContext.auditId,
      riskScore: securityContext.riskScore,
      timestamp: new Date().toISOString(),
      endpoint: '/api/auth/complete-registration'
    }));

    // Check risk score for suspicious activity
    if (securityContext.riskScore > 70) {
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

    // Get and validate request body
    const body = await request.json();
    const { 
      invitation_token, 
      email, 
      password, 
      first_name, 
      last_name,
      phone,
      emergency_contact
    } = body;

    // Validate required fields
    if (!invitation_token || !email || !password || !first_name || !last_name) {
      return NextResponse.json({
        error: {
          message: 'Missing required fields',
          code: 'VALIDATION_ERROR',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString(),
          details: {
            required: ['invitation_token', 'email', 'password', 'first_name', 'last_name']
          }
        }
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        error: {
          message: 'Invalid email format',
          code: 'INVALID_EMAIL_FORMAT',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Validate password strength using utility
    const isValidPassword = validatePassword(password);
    if (!isValidPassword) {
      return NextResponse.json({
        error: {
          message: 'Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters',
          code: 'WEAK_PASSWORD',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Try to find student by invitation token and email
    const student = await (Student as any).findOne({
      invitation_token: invitation_token,
      contact_email: email.toLowerCase()
    });

    // Try to find instructor by invitation token and email
    const instructor = await (Instructor as any).findOne({
      invitation_token: invitation_token,
      contact_email: email.toLowerCase()
    });

    // Check if either student or instructor invitation exists
    if (!student && !instructor) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Invalid invitation token or email attempted',
        auditId: securityContext.auditId,
        email: email.toLowerCase(),
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        error: {
          message: 'Invalid invitation token or email',
          code: 'INVALID_INVITATION',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    const invitee = student || instructor;
    const inviteeType = student ? 'student' : 'instructor';

    // Check if invitation has expired
    if (invitee.invitation_expires_at && invitee.invitation_expires_at < new Date()) {
      return NextResponse.json({
        error: {
          message: 'Invitation has expired. Please request a new invitation.',
          code: 'INVITATION_EXPIRED',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Check if invitee already has a user account
    if (invitee.user_id) {
      return NextResponse.json({
        error: {
          message: `This ${inviteeType} already has a user account`,
          code: 'ACCOUNT_ALREADY_EXISTS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Check if user with this email already exists
    const existingUser = await (User as any).findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json({
        error: {
          message: 'A user account with this email already exists',
          code: 'EMAIL_ALREADY_EXISTS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 409 });
    }

    // Hash the password with secure salt rounds
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user account
    const userData: any = {
      email: email.toLowerCase(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      password: hashedPassword,
      role: inviteeType,
      organization_id: invitee.organization_id,
      isActive: true,
      emailVerified: true, // Auto-verify since they came through invitation
      mfaEnabled: false,
      mfaVerified: false
    };

    // Set the appropriate ID field based on invitee type
    if (inviteeType === 'student') {
      userData.student_id = invitee._id;
    } else {
      userData.instructor_id = invitee._id;
    }

    const newUser = new User(userData);
    await newUser.save();

    // Update invitee record with user_id and clear invitation fields
    const updateData: any = {
      user_id: newUser._id
    };

    // Encrypt and store phone and emergency contact if provided
    if (phone) {
      updateData.phone = await encryptSecure(phone);
    }
    if (emergency_contact) {
      updateData.emergency_contact = await encryptSecure(JSON.stringify(emergency_contact));
    }

    // Additional updates for instructors
    if (inviteeType === 'instructor') {
      updateData.status = 'Active'; // Activate instructor upon registration
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: `Updating ${inviteeType} record`,
      auditId: securityContext.auditId,
      inviteeId: invitee._id.toString(),
      newUserId: newUser._id.toString(),
      timestamp: new Date().toISOString()
    }));

    const Model = inviteeType === 'student' ? Student : Instructor;
    const updatedInvitee = await (Model as any).findByIdAndUpdate(
      invitee._id, 
      { 
        $set: updateData, 
        $unset: {
          invitation_token: "",
          invitation_sent_at: "",
          invitation_expires_at: ""
        }
      },
      { new: true }
    );

    if (!updatedInvitee) {
      // Cleanup: delete the user if invitee update failed
      await User.findByIdAndDelete(newUser._id);
      
      console.error(JSON.stringify({
        level: 'ERROR',
        message: `Failed to link user account to ${inviteeType} record`,
        auditId: securityContext.auditId,
        userId: newUser._id.toString(),
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        error: {
          message: `Failed to link user account to ${inviteeType} record`,
          code: 'ACCOUNT_LINKING_FAILED',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 500 });
    }

    // Generate JWT token for immediate login
    const tokenPayload: any = {
      userId: newUser._id.toString(),
      email: newUser.email,
      role: newUser.role,
      organization_id: newUser.organization_id?.toString()
    };

    // Add the appropriate ID field based on user type
    if (inviteeType === 'student') {
      tokenPayload.student_id = newUser.student_id?.toString();
    } else {
      tokenPayload.instructor_id = newUser.instructor_id?.toString();
    }

    const token = await generateToken(tokenPayload);

    console.log(JSON.stringify({
      level: 'INFO',
      message: `${inviteeType} registration completed successfully`,
      auditId: securityContext.auditId,
      userId: newUser._id.toString(),
      [`${inviteeType}Id`]: invitee._id.toString(),
      email: sanitizeData(email, 'confidential'),
      organizationId: invitee.organization_id.toString(),
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }));

    // Create sanitized response data
    const responseData: any = {
      success: true,
      message: 'Account created successfully',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      user: sanitizeData({
        _id: newUser._id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role: newUser.role,
        organization_id: newUser.organization_id,
        isActive: newUser.isActive,
        emailVerified: newUser.emailVerified
      }, 'confidential'),
      token,
      securityContext: {
        sessionId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'AES-256'
      }
    };

    // Add the appropriate ID field to user object
    if (inviteeType === 'student') {
      responseData.user.student_id = newUser.student_id;
      responseData.student = sanitizeData({
        _id: student!._id,
        contact_email: student!.contact_email,
        program: student!.program,
        status: student!.status,
        stage: student!.stage,
        nextMilestone: student!.nextMilestone
      }, 'confidential');
    } else {
      responseData.user.instructor_id = newUser.instructor_id;
      responseData.instructor = sanitizeData({
        _id: instructor!._id,
        contact_email: instructor!.contact_email,
        specialties: instructor!.specialties,
        status: instructor!.status,
        hourlyRates: instructor!.hourlyRates,
        availability: instructor!.availability
      }, 'confidential');
    }

    const response = NextResponse.json(responseData, { status: 201 });

    // Set token as httpOnly cookie for automatic login
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return response;

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Registration completion failed',
      auditId: securityContext.auditId,
      error: error.message,
      stack: process?.env?.NODE_ENV === 'development' ? error.stack : undefined,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }));

    throw error; // Let the global errorHandler process it
  }
}, REGISTRATION_SECURITY_CONFIG);

// GET /api/auth/complete-registration - Validate invitation token
export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Invitation validation request received',
      auditId: securityContext.auditId,
      riskScore: securityContext.riskScore,
      timestamp: new Date().toISOString(),
      endpoint: '/api/auth/complete-registration'
    }));

    // Get query parameters
    const url = new URL(request.url);
    const invitation_token = url.searchParams.get('token');
    const email = url.searchParams.get('email');

    if (!invitation_token || !email) {
      return NextResponse.json({
        error: {
          message: 'Missing invitation token or email',
          code: 'MISSING_PARAMETERS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Try to find student by invitation token and email
    const student = await (Student as any).findOne({
      invitation_token: invitation_token,
      contact_email: email.toLowerCase()
    }).populate('organization_id', 'name');

    // Try to find instructor by invitation token and email
    const instructor = await (Instructor as any).findOne({
      invitation_token: invitation_token,
      contact_email: email.toLowerCase()
    }).populate('organization_id', 'name');

    // Check if either student or instructor invitation exists
    if (!student && !instructor) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Invalid invitation validation attempt',
        auditId: securityContext.auditId,
        email: sanitizeData(email.toLowerCase(), 'confidential'),
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        error: {
          message: 'Invalid invitation token or email',
          code: 'INVALID_INVITATION',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    const invitee = student || instructor;
    const inviteeType = student ? 'student' : 'instructor';

    // Check if invitation has expired
    if (invitee.invitation_expires_at && invitee.invitation_expires_at < new Date()) {
      return NextResponse.json({
        error: {
          message: 'Invitation has expired',
          code: 'INVITATION_EXPIRED',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Check if invitee already has a user account
    if (invitee.user_id) {
      return NextResponse.json({
        error: {
          message: `This ${inviteeType} already has a user account`,
          code: 'ACCOUNT_ALREADY_EXISTS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Return sanitized invitation details
    const responseData: any = {
      success: true,
      message: 'Invitation is valid',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      data: {
        valid: true,
        type: inviteeType,
        invitation: sanitizeData({
          email: invitee.contact_email,
          organization: invitee.organization_id,
          expires_at: invitee.invitation_expires_at,
          sent_at: invitee.invitation_sent_at
        }, 'confidential')
      },
      securityContext: {
        sessionId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'AES-256'
      }
    };

    // Add type-specific fields
    if (inviteeType === 'student') {
      responseData.data.invitation.program = student!.program;
    } else {
      responseData.data.invitation.specialties = instructor!.specialties;
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Invitation validation completed successfully',
      auditId: securityContext.auditId,
      invitationType: inviteeType,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json(responseData);

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Invitation validation failed',
      auditId: securityContext.auditId,
      error: error.message,
      stack: process?.env?.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }));

    throw error; // Let the global errorHandler process it
  }
}, {
  requireAuth: false, // No auth required for validation
  requireApiKey: true, // Still require API key
  enableFraudDetection: true, // Monitor for suspicious validation attempts
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 50, // Higher limit for validation requests
    windowMs: 60000,
    slidingWindow: true
  }
}); 