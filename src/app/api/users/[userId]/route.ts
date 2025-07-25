import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import { User } from '@/models/User';

// GET security configuration
const USER_GET_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: false, // GET request, CSRF not required
  allowedRoles: ['sys_admin', 'school_admin', 'instructor', 'student', 'mechanic', 'member'],
  requireOrganizationAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000
  }
};

// PUT security configuration (higher security for user modification)
const USER_MODIFY_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  allowedRoles: ['sys_admin', 'school_admin', 'instructor', 'student', 'mechanic', 'member'],
  requireOrganizationAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 50,
    windowMs: 60000
  }
};

// GET /api/users/[userId] - Get user information
export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing user information request',
    auditId: securityContext.auditId,
    targetUserId: params.userId,
    requestingUserId: securityContext.user.id,
    requestingUserRole: securityContext.user.role,
    timestamp: new Date().toISOString()
  }));

  // Validate user ID
  if (!mongoose.Types.ObjectId.isValid(params.userId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid user ID format',
        code: 'INVALID_USER_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find user by ID
  const user = await User.findById(params.userId);
  
  if (!user) {
    return NextResponse.json({
      error: {
        message: 'User not found',
        code: 'USER_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Access control: Users can only view their own profile unless they're admin/instructor
  const canViewUser = 
    securityContext.user.id === params.userId || // Own profile
    securityContext.user.role === 'sys_admin' || // System admin can view all
    (securityContext.user.role === 'school_admin' && user.organization_id?.toString() === securityContext.organizationId) || // School admin can view users in their organization
    (securityContext.user.role === 'instructor' && user.organization_id?.toString() === securityContext.organizationId); // Instructor can view users in their organization

  if (!canViewUser) {
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to view this user',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Create a safe user object without sensitive data
  const safeUser = {
    _id: user._id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    organization_id: user.organization_id,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    mfaEnabled: user.mfaEnabled,
    mfaVerified: user.mfaVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'User information retrieved successfully',
    auditId: securityContext.auditId,
    targetUserId: params.userId,
    userRole: user.role,
    userOrganizationId: user.organization_id,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'User information retrieved successfully',
    data: { user: safeUser },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, USER_GET_SECURITY_CONFIG);

// PUT /api/users/[userId] - Update user information
export const PUT = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing user update request',
    auditId: securityContext.auditId,
    targetUserId: params.userId,
    requestingUserId: securityContext.user.id,
    requestingUserRole: securityContext.user.role,
    timestamp: new Date().toISOString()
  }));

  // Validate user ID
  if (!mongoose.Types.ObjectId.isValid(params.userId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid user ID format',
        code: 'INVALID_USER_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find user by ID
  const user = await User.findById(params.userId);
  
  if (!user) {
    return NextResponse.json({
      error: {
        message: 'User not found',
        code: 'USER_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Access control: Users can only update their own profile unless they're admin
  const canUpdateUser = 
    securityContext.user.id === params.userId || // Own profile
    securityContext.user.role === 'sys_admin' || // System admin can update all
    (securityContext.user.role === 'school_admin' && user.organization_id?.toString() === securityContext.organizationId); // School admin can update users in their organization

  if (!canUpdateUser) {
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to update this user',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Get request body
  const body = await request.json();
  
  // Get the fields that can be updated
  const allowedFields = [
    'email',
    'first_name',
    'last_name',
    'role',
    'organization_id',
    'isActive',
    'emailVerified',
    'mfaEnabled',
    'mfaVerified'
  ];

  // Filter out fields that are not allowed to be updated
  const updates = Object.keys(body)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = body[key];
      return obj;
    }, {} as any);

  // Validate email format if being updated
  if (updates.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updates.email)) {
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

  // If email is being changed, check if it already exists
  if (updates.email && updates.email !== user.email) {
    const existingUser = await User.findOne({ email: updates.email });
    if (existingUser) {
      return NextResponse.json({
        error: {
          message: 'Email already in use',
          code: 'EMAIL_ALREADY_EXISTS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 409 });
    }
  }

  // If role is being changed, only sys_admin can change roles
  if (updates.role && updates.role !== user.role && securityContext.user.role !== 'sys_admin') {
    return NextResponse.json({
      error: {
        message: 'Only system administrators can change user roles',
        code: 'ROLE_CHANGE_FORBIDDEN',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate role if being updated
  if (updates.role) {
    const validRoles = ['sys_admin', 'school_admin', 'instructor', 'student', 'mechanic', 'member'];
    if (!validRoles.includes(updates.role)) {
      return NextResponse.json({
        error: {
          message: 'Invalid role specified',
          code: 'INVALID_ROLE',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
  }

  // Validate organization_id if being updated
  if (updates.organization_id && !mongoose.Types.ObjectId.isValid(updates.organization_id)) {
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID format',
        code: 'INVALID_ORGANIZATION_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Update user
  const updatedUser = await User.findByIdAndUpdate(
    params.userId,
    { $set: updates },
    { new: true, runValidators: true }
  );
  
  if (!updatedUser) {
    return NextResponse.json({
      error: {
        message: 'Failed to update user',
        code: 'UPDATE_FAILED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }

  // Create a safe user object without sensitive data
  const safeUser = {
    _id: updatedUser._id,
    email: updatedUser.email,
    first_name: updatedUser.first_name,
    last_name: updatedUser.last_name,
    role: updatedUser.role,
    organization_id: updatedUser.organization_id,
    isActive: updatedUser.isActive,
    emailVerified: updatedUser.emailVerified,
    mfaEnabled: updatedUser.mfaEnabled,
    mfaVerified: updatedUser.mfaVerified,
    createdAt: updatedUser.createdAt,
    updatedAt: updatedUser.updatedAt
  };

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'User updated successfully',
    auditId: securityContext.auditId,
    targetUserId: params.userId,
    updatedFields: Object.keys(updates),
    processingTime,
    timestamp: new Date().toISOString()
  }));
  
  return NextResponse.json({
    success: true,
    message: 'User updated successfully',
    data: { user: safeUser },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, USER_MODIFY_SECURITY_CONFIG); 