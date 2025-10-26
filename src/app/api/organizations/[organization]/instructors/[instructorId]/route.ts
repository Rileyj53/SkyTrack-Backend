import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import Instructor from '@/models/Instructor';
import mongoose from 'mongoose';

// Security configuration for individual instructor endpoints
const INSTRUCTOR_ITEM_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // Required for PUT/DELETE operations
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin', 'instructor'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET /api/organizations/[organizationId]/instructors/[instructorId] - Get a specific instructor
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, instructorId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing instructor detail request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    instructorId: params.instructorId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(params.instructorId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID or instructor ID format provided',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      instructorId: params.instructorId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID or instructor ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find the instructor (still using organization_id in database for now)
  const instructor = await (mongoose.model('Instructor') as any).findOne({
    _id: new mongoose.Types.ObjectId(params.instructorId),
    organization_id: new mongoose.Types.ObjectId(params.organization)
  }).populate('user_id', 'first_name last_name email role').lean();

  if (!instructor) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Instructor not found',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      instructorId: params.instructorId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Instructor not found',
        code: 'INSTRUCTOR_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Role-based access control
  const userRole = securityContext.user?.role;
  const userId = securityContext.user?.id;
  
  // Instructors can only view their own data
  if (userRole === 'instructor') {
    const instructorUserId = instructor.user_id?._id?.toString() || instructor.user_id?.toString();
    if (instructorUserId !== userId) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Instructor attempted to access another instructor\'s data',
        auditId: securityContext.auditId,
        userId: userId,
        instructorId: params.instructorId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Access denied: You can only view your own instructor data',
          code: 'ACCESS_DENIED',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 403 });
    }
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Instructor detail request completed successfully',
    auditId: securityContext.auditId,
    instructorId: params.instructorId,
    userRole: userRole,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Instructor retrieved successfully',
    data: {
      instructor
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, INSTRUCTOR_ITEM_SECURITY_CONFIG);

// PUT /api/organizations/[organizationId]/instructors/[instructorId] - Update an instructor
export const PUT = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, instructorId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing instructor update request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    instructorId: params.instructorId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(params.instructorId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID or instructor ID format provided for update',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      instructorId: params.instructorId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID or instructor ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Role-based access control
  const userRole = securityContext.user?.role;
  const userId = securityContext.user?.id;

  // Find the instructor first to check permissions (still using organization_id in database for now)
  const instructor = await (mongoose.model('Instructor') as any).findOne({
    _id: new mongoose.Types.ObjectId(params.instructorId),
    organization_id: new mongoose.Types.ObjectId(params.organization)
  }).populate('user_id', '_id');

  if (!instructor) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Instructor not found for update',
      auditId: securityContext.auditId,
      instructorId: params.instructorId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Instructor not found',
        code: 'INSTRUCTOR_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // If instructor role, they can only update their own data
  if (userRole === 'instructor') {
    const instructorUserId = instructor.user_id?._id?.toString() || instructor.user_id?.toString();
    if (instructorUserId !== userId) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Instructor attempted to update another instructor\'s data',
        auditId: securityContext.auditId,
        userId: userId,
        instructorId: params.instructorId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Instructors can only update their own data',
          code: 'FORBIDDEN_ACCESS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 403 });
    }
  }

  // Parse request body
  const body = await request.json();

  // If license number is being updated, check if it's already in use
  if (body.license_number && body.license_number !== instructor.license_number) {
    const existingLicense = await (mongoose.model('Instructor') as any).findOne({
      license_number: body.license_number,
      _id: { $ne: params.instructorId }
    }).exec();

    if (existingLicense) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'License number already in use during update',
        auditId: securityContext.auditId,
        licenseNumber: body.license_number,
        instructorId: params.instructorId,
        existingInstructorId: existingLicense._id,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'License number is already in use',
          code: 'LICENSE_EXISTS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 409 });
    }
  }

  // Update instructor fields
  const updateFields: any = {};
  
  if (body.contact_email !== undefined) updateFields.contact_email = body.contact_email;
  if (body.phone !== undefined) updateFields.phone = body.phone;
  if (body.certifications !== undefined) updateFields.certifications = body.certifications;
  if (body.license_number !== undefined) updateFields.license_number = body.license_number;
  if (body.emergency_contact !== undefined) updateFields.emergency_contact = body.emergency_contact;
  if (body.specialties !== undefined) updateFields.specialties = body.specialties;
  if (body.status !== undefined) updateFields.status = body.status;
  if (body.hourlyRates !== undefined) updateFields.hourlyRates = body.hourlyRates;
  if (body.flightHours !== undefined) updateFields.flightHours = body.flightHours;
  if (body.teachingHours !== undefined) updateFields.teachingHours = body.teachingHours;
  if (body.availability !== undefined) updateFields.availability = body.availability;
  if (body.students !== undefined) updateFields.students = body.students;
  if (body.utilization !== undefined) updateFields.utilization = body.utilization;
  if (body.ratings !== undefined) updateFields.ratings = body.ratings;
  if (body.availability_time !== undefined) updateFields.availability_time = body.availability_time;
  if (body.notes !== undefined) updateFields.notes = body.notes;
  if (body.documents !== undefined) updateFields.documents = body.documents;

  // Update the instructor
  const updatedInstructor = await (mongoose.model('Instructor') as any).findByIdAndUpdate(
    params.instructorId,
    { $set: updateFields },
    { new: true, runValidators: true }
  ).populate('user_id', 'first_name last_name email role').lean();

  if (!updatedInstructor) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Failed to update instructor',
      auditId: securityContext.auditId,
      instructorId: params.instructorId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Failed to update instructor',
        code: 'UPDATE_FAILED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Instructor updated successfully',
    auditId: securityContext.auditId,
    instructorId: params.instructorId,
    updatedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  // Return the updated instructor
  return NextResponse.json({
    success: true,
    message: 'Instructor updated successfully',
    data: {
      instructor: updatedInstructor
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, INSTRUCTOR_ITEM_SECURITY_CONFIG);

// DELETE /api/organizations/[organizationId]/instructors/[instructorId] - Delete an instructor
export const DELETE = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, instructorId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing instructor deletion request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    instructorId: params.instructorId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can delete instructors
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to delete instructor',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      instructorId: params.instructorId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to delete instructors',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(params.instructorId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID or instructor ID format provided for deletion',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      instructorId: params.instructorId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID or instructor ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find and delete the instructor (still using organization_id in database for now)
  const instructor = await (mongoose.model('Instructor') as any).findOneAndDelete({
    _id: new mongoose.Types.ObjectId(params.instructorId),
    organization_id: new mongoose.Types.ObjectId(params.organization)
  }).exec();

  if (!instructor) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Instructor not found for deletion',
      auditId: securityContext.auditId,
      instructorId: params.instructorId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Instructor not found',
        code: 'INSTRUCTOR_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Instructor deleted successfully',
    auditId: securityContext.auditId,
    instructorId: params.instructorId,
    organizationId: params.organization,
    deletedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Instructor deleted successfully',
    data: {
      instructor_id: params.instructorId
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, INSTRUCTOR_ITEM_SECURITY_CONFIG); 