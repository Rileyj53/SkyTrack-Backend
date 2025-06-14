import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import Instructor from '@/models/Instructor';
import { User } from '@/models/User';
import mongoose, { Error as MongooseError } from 'mongoose';

// Security configuration for instructor endpoints
const INSTRUCTOR_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // Required for POST/PUT/DELETE operations
  allowedRoles: ['sys_admin', 'school_admin', 'instructor'],
  requireSchoolAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET handler to retrieve all instructors for a school
export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing instructors list request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate school ID
  if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid school ID format provided',
      auditId: securityContext.auditId,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid school ID format',
        code: 'INVALID_SCHOOL_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find all instructors for the school
  const schoolId = new mongoose.Types.ObjectId(params.schoolId);
  const instructors = await (mongoose.model('Instructor') as any).find({
    school_id: schoolId
  }).populate('user_id', 'first_name last_name email role').lean();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Instructors list request completed successfully',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    instructorsCount: instructors.length,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Instructors retrieved successfully',
    data: {
      instructors
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, INSTRUCTOR_SECURITY_CONFIG);

// POST handler to create a new instructor
export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing instructor creation request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can create instructors
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to create instructor',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to create instructors',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate school ID
  if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid school ID format provided for instructor creation',
      auditId: securityContext.auditId,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid school ID format',
        code: 'INVALID_SCHOOL_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Parse request body
  const body = await request.json();

  // Validate required fields
  const requiredFields = ['user_id', 'contact_email', 'phone', 'license_number'];
  for (const field of requiredFields) {
    if (!body[field]) {
      return NextResponse.json({
        error: {
          message: `Missing required field: ${field}`,
          code: 'MISSING_REQUIRED_FIELD',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
  }

  // Validate user_id format
  if (!mongoose.Types.ObjectId.isValid(body.user_id)) {
    return NextResponse.json({
      error: {
        message: 'Invalid user_id format',
        code: 'INVALID_USER_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Check if user exists and has instructor role
  const user = await (mongoose.model('User') as any).findById(body.user_id);
  if (!user) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'User not found for instructor creation',
      auditId: securityContext.auditId,
      userId: body.user_id,
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

  if (user.role !== 'instructor') {
    return NextResponse.json({
      error: {
        message: 'User must have instructor role',
        code: 'INVALID_USER_ROLE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Check if instructor already exists for this user
  const existingInstructor = await (mongoose.model('Instructor') as any).findOne({
    user_id: body.user_id,
    school_id: params.schoolId
  }).exec();

  if (existingInstructor) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Instructor already exists for user in school',
      auditId: securityContext.auditId,
      userId: body.user_id,
      schoolId: params.schoolId,
      existingInstructorId: existingInstructor._id,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Instructor already exists for this user in this school',
        code: 'INSTRUCTOR_EXISTS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 409 });
  }

  // Check if license number is already in use
  const existingLicense = await (mongoose.model('Instructor') as any).findOne({
    license_number: body.license_number
  }).exec();

  if (existingLicense) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'License number already in use',
      auditId: securityContext.auditId,
      licenseNumber: body.license_number,
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

  // Create new instructor
  const InstructorModel = mongoose.model('Instructor');
  const instructor = new InstructorModel({
    school_id: params.schoolId,
    user_id: body.user_id,
    contact_email: body.contact_email,
    phone: body.phone,
    certifications: body.certifications || [],
    license_number: body.license_number,
    emergency_contact: body.emergency_contact || {
      name: '',
      relationship: '',
      phone: ''
    },
    specialties: body.specialties || [],
    status: body.status || 'Active',
    hourlyRates: body.hourlyRates || {
      primary: 0,
      instrument: 0,
      advanced: 0,
      multiEngine: 0
    },
    flightHours: body.flightHours || 0,
    teachingHours: body.teachingHours || 0,
    availability: body.availability || 'Full-time',
    students: body.students || 0,
    utilization: body.utilization || 0,
    ratings: body.ratings || [],
    availability_time: body.availability_time || {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: []
    },
    notes: body.notes || '',
    documents: body.documents || []
  });

  // Save the instructor
  await instructor.save();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Instructor created successfully',
    auditId: securityContext.auditId,
    instructorId: instructor._id,
    userId: body.user_id,
    schoolId: params.schoolId,
    createdBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  // Return the created instructor
  return NextResponse.json({
    success: true,
    message: 'Instructor created successfully',
    data: {
      instructor
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }, { status: 201 });
}, INSTRUCTOR_SECURITY_CONFIG);

// DELETE /api/schools/[schoolId]/instructors - Delete an instructor
export const DELETE = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing instructor deletion request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
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

  // Get instructor ID from query params
  const instructorId = request.nextUrl.searchParams.get('instructorId');
  if (!instructorId) {
    return NextResponse.json({
      error: {
        message: 'Instructor ID is required',
        code: 'MISSING_INSTRUCTOR_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(instructorId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid ID format provided for instructor deletion',
      auditId: securityContext.auditId,
      schoolId: params.schoolId,
      instructorId: instructorId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find and delete the instructor
  const instructor = await (Instructor as any).findOneAndDelete({
    _id: instructorId,
    school_id: params.schoolId
  });

  if (!instructor) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Instructor not found for deletion',
      auditId: securityContext.auditId,
      instructorId: instructorId,
      schoolId: params.schoolId,
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
    instructorId: instructorId,
    schoolId: params.schoolId,
    deletedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Instructor deleted successfully',
    data: {
      instructor_id: instructorId
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, INSTRUCTOR_SECURITY_CONFIG);

// PUT /api/schools/[schoolId]/instructors - Update an instructor
export const PUT = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing instructor update request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Get instructor ID from query params
  const instructorId = request.nextUrl.searchParams.get('instructorId');
  if (!instructorId) {
    return NextResponse.json({
      error: {
        message: 'Instructor ID is required',
        code: 'MISSING_INSTRUCTOR_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(instructorId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid ID format provided for instructor update',
      auditId: securityContext.auditId,
      schoolId: params.schoolId,
      instructorId: instructorId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Role-based access control
  const userRole = securityContext.user?.role;
  const userId = securityContext.user?.id;

  // Students cannot access this endpoint
  if (userRole === 'student') {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Student attempted to access instructor update endpoint',
      auditId: securityContext.auditId,
      userId: userId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Students cannot access this endpoint',
        code: 'FORBIDDEN_ROLE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // If instructor, they can only update their own data
  if (userRole === 'instructor') {
    // Find the instructor record to get the user_id
    const instructorRecord = await (Instructor as any).findOne({
      _id: instructorId,
      school_id: params.schoolId
    }).populate('user_id', '_id').lean();

    if (!instructorRecord) {
      return NextResponse.json({
        error: {
          message: 'Instructor not found',
          code: 'INSTRUCTOR_NOT_FOUND',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    const instructorUserId = instructorRecord.user_id?._id?.toString() || instructorRecord.user_id?.toString();
    if (instructorUserId !== userId) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Instructor attempted to update another instructor\'s data',
        auditId: securityContext.auditId,
        userId: userId,
        instructorId: instructorId,
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

  // Get request body
  const body = await request.json();

  // Find the instructor
  const instructor = await (Instructor as any).findOne({
    _id: instructorId,
    school_id: params.schoolId
  });

  if (!instructor) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Instructor not found for update',
      auditId: securityContext.auditId,
      instructorId: instructorId,
      schoolId: params.schoolId,
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

  // If license number is being updated, check if it's already in use
  if (body.license_number && body.license_number !== instructor.license_number) {
    const existingInstructor = await (mongoose.model('Instructor') as any).findOne({
      school_id: params.schoolId,
      license_number: body.license_number,
      _id: { $ne: instructorId }
    }).exec();

    if (existingInstructor) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'License number already in use during update',
        auditId: securityContext.auditId,
        licenseNumber: body.license_number,
        instructorId: instructorId,
        existingInstructorId: existingInstructor._id,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'License number is already in use for this school',
          code: 'LICENSE_EXISTS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
  }

  // Update the instructor
  const updatedInstructor = await (Instructor as any).findByIdAndUpdate(
    instructorId,
    { $set: body },
    { new: true, runValidators: true }
  );

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Instructor updated successfully',
    auditId: securityContext.auditId,
    instructorId: instructorId,
    updatedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Instructor updated successfully',
    data: {
      instructor: updatedInstructor
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, INSTRUCTOR_SECURITY_CONFIG); 