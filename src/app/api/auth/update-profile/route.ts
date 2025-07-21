import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { User, Student, Instructor } from '@/models';
import { encryptSecure } from '@/lib/encryption';
import { sanitizeData } from '@/middleware/security';

// Security configuration for profile update endpoint
const PROFILE_UPDATE_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true, // Authentication required
  requireApiKey: true, // API key required
  requireCSRF: true, // CSRF protection for profile updates
  allowedRoles: ['sys_admin', 'school_admin', 'instructor', 'student'], // All authenticated users
  enableFraudDetection: true, // Monitor profile update patterns
  enableAdvancedAudit: true, // Track profile changes
  dataClassification: 'confidential', // Contains personal information
  rateLimiting: {
    maxRequests: 20, // Reasonable rate limit for profile updates
    windowMs: 60000, // 1 minute window
    slidingWindow: true
  },
  maxRequestSize: 10 * 1024 // 10KB max for profile updates
};

// PUT /api/auth/update-profile - Update user profile information
export const PUT = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Profile update request received',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      riskScore: securityContext.riskScore,
      timestamp: new Date().toISOString(),
      endpoint: 'PUT /api/auth/update-profile'
    }));

    // Check risk score for suspicious activity
    if (securityContext.riskScore > 75) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'High risk profile update attempt blocked',
        auditId: securityContext.auditId,
        userId: securityContext.user?.id,
        riskScore: securityContext.riskScore,
        fraudFlags: securityContext.fraudFlags,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        error: {
          message: 'Profile update blocked due to security policy',
          code: 'HIGH_RISK_PROFILE_UPDATE',
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
      first_name, 
      last_name,
      email,
      phone,
      avatar,
      emergency_contact
    } = body;

    // Validate that at least one field is provided
    if (!first_name && !last_name && !email && !phone && !avatar && !emergency_contact) {
      return NextResponse.json({
        error: {
          message: 'At least one field must be provided for update',
          code: 'NO_UPDATE_FIELDS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Validate email format if provided
    if (email) {
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
    }

    // Validate name fields if provided
    if (first_name && (first_name.trim().length < 1 || first_name.trim().length > 50)) {
      return NextResponse.json({
        error: {
          message: 'First name must be between 1 and 50 characters',
          code: 'INVALID_FIRST_NAME',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    if (last_name && (last_name.trim().length < 1 || last_name.trim().length > 50)) {
      return NextResponse.json({
        error: {
          message: 'Last name must be between 1 and 50 characters',
          code: 'INVALID_LAST_NAME',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Validate avatar URL if provided
    if (avatar && avatar.trim().length > 0) {
      try {
        new URL(avatar);
      } catch (error) {
        return NextResponse.json({
          error: {
            message: 'Avatar must be a valid URL',
            code: 'INVALID_AVATAR_URL',
            requestId: securityContext.auditId,
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
    }

    // Get current user
    const userId = securityContext.user?.id;
    const currentUser = await User.findById(userId);
    
    if (!currentUser) {
      console.error(JSON.stringify({
        level: 'ERROR',
        message: 'User not found during profile update',
        auditId: securityContext.auditId,
        userId: userId,
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

    // Check if email is being changed and if it already exists
    if (email && email.toLowerCase() !== currentUser.email.toLowerCase()) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'Attempt to update to existing email',
          auditId: securityContext.auditId,
          userId: userId,
          email: sanitizeData(email.toLowerCase(), 'confidential'),
          timestamp: new Date().toISOString()
        }));
        
        return NextResponse.json({
          error: {
            message: 'Email address is already in use',
            code: 'EMAIL_ALREADY_EXISTS',
            requestId: securityContext.auditId,
            timestamp: new Date().toISOString()
          }
        }, { status: 409 });
      }
    }

    // Prepare update data for User model
    const userUpdateData: any = {};
    if (first_name) userUpdateData.first_name = first_name.trim();
    if (last_name) userUpdateData.last_name = last_name.trim();
    if (email) {
      userUpdateData.email = email.toLowerCase();
      userUpdateData.emailVerified = false; // Reset email verification when email changes
    }
    if (phone) userUpdateData.phone = phone.trim();
    if (avatar) userUpdateData.avatar = avatar.trim();

    // Handle emergency_contact in related models if provided
    let relatedUpdateData: any = {};
    if (emergency_contact) relatedUpdateData.emergency_contact = await encryptSecure(JSON.stringify(emergency_contact));

    // Log the update attempt
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Updating user profile',
      auditId: securityContext.auditId,
      userId: userId,
      fieldsBeingUpdated: Object.keys(userUpdateData),
      emailChanged: !!email,
      phoneUpdated: !!phone,
      avatarUpdated: !!avatar,
      timestamp: new Date().toISOString()
    }));

    // Update the User record
    if (Object.keys(userUpdateData).length > 0) {
      await User.findByIdAndUpdate(userId, { $set: userUpdateData }, { new: true });
    }

    // Update related Student or Instructor record if emergency_contact provided
    if (Object.keys(relatedUpdateData).length > 0) {
      // Determine if user is a student or instructor and update accordingly
      if (currentUser.student_id) {
        await (Student as any).findByIdAndUpdate(
          currentUser.student_id, 
          { $set: relatedUpdateData }, 
          { new: true }
        );
        console.log(JSON.stringify({
          level: 'INFO',
          message: 'Updated student record with encrypted emergency contact',
          auditId: securityContext.auditId,
          userId: userId,
          studentId: currentUser.student_id.toString(),
          fieldsUpdated: Object.keys(relatedUpdateData),
          timestamp: new Date().toISOString()
        }));
      } else if (currentUser.instructor_id) {
        await (Instructor as any).findByIdAndUpdate(
          currentUser.instructor_id, 
          { $set: relatedUpdateData }, 
          { new: true }
        );
        console.log(JSON.stringify({
          level: 'INFO',
          message: 'Updated instructor record with encrypted emergency contact',
          auditId: securityContext.auditId,
          userId: userId,
          instructorId: currentUser.instructor_id.toString(),
          fieldsUpdated: Object.keys(relatedUpdateData),
          timestamp: new Date().toISOString()
        }));
      }
    }

    // Fetch updated user data
    const updatedUser = await User.findById(userId).lean();

    // Clean user object - remove sensitive fields
    const cleanUser = Object.fromEntries(
      Object.entries(updatedUser!)
        .filter(([key, value]) => {
          const sensitiveFields = ['password', 'mfaSecret', 'mfaBackupCodes', 'resetToken', 'resetTokenExpiration', 'magicToken', 'magicTokenExpiration', 'magicCode'];
          return value !== null && !sensitiveFields.includes(key);
        })
    );

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Profile update completed successfully',
      auditId: securityContext.auditId,
      userId: userId,
      emailChanged: !!email,
      phoneUpdated: !!phone,
      avatarUpdated: !!avatar,
      emergencyContactUpdated: !!emergency_contact,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    // Create sanitized response data
    const responseData = {
      success: true,
      message: 'Profile updated successfully',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      data: {
        user: sanitizeData(cleanUser, 'confidential')
      },
      securityContext: {
        sessionId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'AES-256'
      }
    };

    // Add email verification notice if email was changed
    if (email) {
      responseData.message = 'Profile updated successfully. Please verify your new email address.';
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Profile update failed',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      error: error.message,
      stack: process?.env?.NODE_ENV === 'development' ? error.stack : undefined,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }));

    throw error; // Let the global errorHandler process it
  }
}, PROFILE_UPDATE_SECURITY_CONFIG); 