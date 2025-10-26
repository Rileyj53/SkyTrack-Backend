import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import FlightScheduleRequest from '@/models/FlightScheduleRequest';
import FlightSchedule from '@/models/FlightSchedule';
import Student from '@/models/Student';
import Instructor from '@/models/Instructor';
import mongoose from 'mongoose';

// Security configuration for flight schedule request endpoints
const FLIGHT_SCHEDULE_REQUEST_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin', 'instructor', 'student'],
  requireOrganizationAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 50,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET /api/organizations/[organizationId]/flight_schedule/requests - List flight schedule requests
export const GET = secureApiRoute(async (
  request: NextRequest,  
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule requests list request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate organization ID
  if (!mongoose.Types.ObjectId.isValid(params.organization)) {
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID format',
        code: 'INVALID_ORGANIZATION_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Role-based access control
  const userRole = securityContext.user?.role;
  const userId = securityContext.user?.id;
  
  let additionalFilter = {};
  
  // Students can only see their own requests
  if (userRole === 'student') {
    additionalFilter = { requested_by: userId };
  }
  
  // Instructors can see requests for flights they would be assigned to
  if (userRole === 'instructor') {
    const instructorRecord = await (Instructor as any).findOne({ user_id: userId }).lean();
    if (!instructorRecord) {
      return NextResponse.json({
        error: {
          message: 'Instructor record not found',
          code: 'INSTRUCTOR_NOT_FOUND',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }
    additionalFilter = { instructor_id: instructorRecord._id };
  }

  // Parse query parameters for filtering
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const status = url.searchParams.get('status');
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');

  // Build filter object
  const filter: any = { 
    organization_id: params.organization,
    ...additionalFilter
  };
  
  if (status) filter.status = status;
  
  if (startDate || endDate) {
    filter.scheduled_start_time = {};
    if (startDate) {
      const startOfDay = new Date(startDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      filter.scheduled_start_time.$gte = startOfDay;
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      filter.scheduled_start_time.$lte = endOfDay;
    }
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Get flight schedule requests with populated data
  const requests = await (FlightScheduleRequest as any)
    .find(filter)
    .populate({
      path: 'organization_id',
      select: 'name address airport phone email'
    })
    .populate({
      path: 'plane_id',
      select: 'registration type aircraftModel status'
    })
    .populate({
      path: 'instructor_id',
      select: 'contact_email status flightHours user_id',
      populate: {
        path: 'user_id',
        select: 'first_name last_name email'
      }
    })
    .populate({
      path: 'student_id',
      select: 'contact_email program status enrollmentDate user_id',
      populate: {
        path: 'user_id',
        select: 'first_name last_name email'
      }
    })
    .populate({
      path: 'requested_by',
      select: 'first_name last_name email'
    })
    .populate({
      path: 'approved_by',
      select: 'first_name last_name email'
    })
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Get total count for pagination
  const total = await FlightScheduleRequest.countDocuments(filter);

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight schedule requests list completed successfully',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userRole: userRole,
    requestsReturned: requests.length,
    totalRequests: total,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight schedule requests retrieved successfully',
    data: {
      requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_SCHEDULE_REQUEST_SECURITY_CONFIG);

// POST /api/organizations/[organizationId]/flight_schedule/requests - Create a new flight schedule request
export const POST = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule request creation',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate organization ID
  if (!mongoose.Types.ObjectId.isValid(params.organization)) {
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID format',
        code: 'INVALID_ORGANIZATION_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Role-based access control - students can create requests, admins/instructors can create on behalf of students
  const userRole = securityContext.user?.role;
  const userId = securityContext.user?.id;
  
  if (!['sys_admin', 'school_admin', 'instructor', 'student'].includes(userRole)) {
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to create flight schedule requests',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Get request body
  const body = await request.json();

  // Enhanced validation to handle both student_id and user_id
  let finalStudentId = body.student_id;
  let finalUserId = body.user_id;

  // Validate that at least one of student_id or user_id is provided
  if (!body.student_id && !body.user_id) {
    return NextResponse.json({
      error: {
        message: 'Either student_id or user_id is required',
        code: 'MISSING_STUDENT_REFERENCE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // If user_id is provided, find the corresponding student_id
  if (body.user_id && !body.student_id) {
    if (!mongoose.Types.ObjectId.isValid(body.user_id)) {
      return NextResponse.json({
        error: {
          message: 'Invalid user_id format',
          code: 'INVALID_USER_ID',
          field: 'user_id',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Find the student record for this user
    const studentRecord = await (Student as any).findOne({ user_id: body.user_id });
    if (!studentRecord) {
      return NextResponse.json({
        error: {
          message: 'No student record found for the provided user_id',
          code: 'STUDENT_NOT_FOUND_FOR_USER',
          field: 'user_id',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    finalStudentId = studentRecord._id.toString();
    finalUserId = body.user_id;
  }

  // If student_id is provided, validate it and optionally find the user_id
  if (body.student_id && !body.user_id) {
    if (!mongoose.Types.ObjectId.isValid(body.student_id)) {
      return NextResponse.json({
        error: {
          message: 'Invalid student_id format',
          code: 'INVALID_STUDENT_ID',
          field: 'student_id',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Find the student record to get the user_id
    const studentRecord = await (Student as any).findById(body.student_id);
    if (!studentRecord) {
      return NextResponse.json({
        error: {
          message: 'Student not found with the provided student_id',
          code: 'STUDENT_NOT_FOUND',
          field: 'student_id',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    finalStudentId = body.student_id;
    finalUserId = studentRecord.user_id?.toString();
  }

  // If both are provided, validate they match
  if (body.student_id && body.user_id) {
    if (!mongoose.Types.ObjectId.isValid(body.student_id) || !mongoose.Types.ObjectId.isValid(body.user_id)) {
      return NextResponse.json({
        error: {
          message: 'Invalid student_id or user_id format',
          code: 'INVALID_ID_FORMAT',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Verify that the student_id and user_id match
    const studentRecord = await (Student as any).findById(body.student_id);
    if (!studentRecord) {
      return NextResponse.json({
        error: {
          message: 'Student not found with the provided student_id',
          code: 'STUDENT_NOT_FOUND',
          field: 'student_id',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    if (studentRecord.user_id?.toString() !== body.user_id) {
      return NextResponse.json({
        error: {
          message: 'The provided student_id and user_id do not match',
          code: 'STUDENT_USER_MISMATCH',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    finalStudentId = body.student_id;
    finalUserId = body.user_id;
  }

  // Validate required fields (excluding student_id since we now have finalStudentId)
  const requiredFieldMessages = {
    'plane_id': 'Aircraft selection is required',
    'scheduled_start_time': 'Scheduled start time is required',
    'scheduled_end_time': 'Scheduled end time is required',
    'flight_type': 'Flight type is required'
  };
  
  for (const [field, message] of Object.entries(requiredFieldMessages)) {
    if (!body[field]) {
      return NextResponse.json({
        error: {
          message: message,
          code: 'MISSING_REQUIRED_FIELD',
          field: field,
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
  }

  // Validate ObjectId fields
  const objectIdFieldMessages = {
    'plane_id': 'Invalid aircraft ID'
  };
  
  for (const [field, message] of Object.entries(objectIdFieldMessages)) {
    if (!mongoose.Types.ObjectId.isValid(body[field])) {
      return NextResponse.json({
        error: {
          message: message,
          code: 'INVALID_OBJECT_ID',
          field: field,
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
  }

  // Validate instructor_id if provided
  if (body.instructor_id && !mongoose.Types.ObjectId.isValid(body.instructor_id)) {
    return NextResponse.json({
      error: {
        message: 'Invalid instructor ID',
        code: 'INVALID_INSTRUCTOR_ID',
        field: 'instructor_id',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate date fields
  const scheduledStartTime = new Date(body.scheduled_start_time);
  const scheduledEndTime = new Date(body.scheduled_end_time);
  
  if (isNaN(scheduledStartTime.getTime()) || isNaN(scheduledEndTime.getTime())) {
    return NextResponse.json({
      error: {
        message: 'Invalid date format - please use ISO 8601 format',
        code: 'INVALID_DATE_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  if (scheduledStartTime >= scheduledEndTime) {
    return NextResponse.json({
      error: {
        message: 'Flight end time must be after start time',
        code: 'INVALID_TIME_RANGE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // For students, verify they can only request for themselves
  if (userRole === 'student') {
    const studentRecord = await (Student as any).findOne({ user_id: userId }).lean();
    if (!studentRecord) {
      return NextResponse.json({
        error: {
          message: 'Student record not found for authenticated user',
          code: 'STUDENT_NOT_FOUND',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }
    
    if (studentRecord._id.toString() !== finalStudentId) {
      return NextResponse.json({
        error: {
          message: 'Students can only create requests for themselves',
          code: 'UNAUTHORIZED_STUDENT_REQUEST',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 403 });
    }
  }

  // Check for existing pending request conflicts
  const existingRequestConflict = await (FlightScheduleRequest as any).findOne({
    organization_id: params.organization,
    student_id: finalStudentId,
    status: 'pending',
    $and: [
      { scheduled_start_time: { $lt: scheduledEndTime } },
      { scheduled_end_time: { $gt: scheduledStartTime } }
    ]
  });

  if (existingRequestConflict) {
    return NextResponse.json({
      error: {
        message: 'You already have a pending request for this time slot',
        code: 'EXISTING_REQUEST_CONFLICT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 409 });
  }

  // Check for conflicts with approved schedules
  const scheduleConflict = await (FlightSchedule as any).findOne({
    organization_id: params.organization,
    $or: [
      { student_id: finalStudentId },
      { plane_id: body.plane_id },
      ...(body.instructor_id ? [{ instructor_id: body.instructor_id }] : [])
    ],
    $and: [
      { scheduled_start_time: { $lt: scheduledEndTime } },
      { scheduled_end_time: { $gt: scheduledStartTime } }
    ],
    status: { $nin: ['canceled', 'completed'] }
  });

  if (scheduleConflict) {
    return NextResponse.json({
      error: {
        message: 'Conflict detected with existing scheduled flight',
        code: 'SCHEDULE_CONFLICT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 409 });
  }

  // Create new flight schedule request
  const flightScheduleRequest = new FlightScheduleRequest({
    organization_id: params.organization,
    plane_id: body.plane_id,
    instructor_id: body.instructor_id || undefined,
    student_id: finalStudentId,
    requested_by: userId,
    scheduled_start_time: scheduledStartTime,
    scheduled_end_time: scheduledEndTime,
    flight_type: body.flight_type,
    request_notes: body.request_notes || '',
    status: 'pending'
  });

  await flightScheduleRequest.save();

  // Populate the created request with related data
  const populatedRequest = await (FlightScheduleRequest as any)
    .findById(flightScheduleRequest._id)
    .populate({
      path: 'organization_id',
      select: 'name address airport phone email'
    })
    .populate({
      path: 'plane_id',
      select: 'registration type aircraftModel status'
    })
    .populate({
      path: 'instructor_id',
      select: 'contact_email status flightHours user_id',
      populate: {
        path: 'user_id',
        select: 'first_name last_name email'
      }
    })
    .populate({
      path: 'student_id',
      select: 'contact_email program status enrollmentDate user_id',
      populate: {
        path: 'user_id',
        select: 'first_name last_name email'
      }
    })
    .populate({
      path: 'requested_by',
      select: 'first_name last_name email'
    })
    .populate({
      path: 'approved_by',
      select: 'first_name last_name email'
    })
    .lean();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight schedule request created successfully',
    auditId: securityContext.auditId,
    requestId: flightScheduleRequest._id,
    organizationId: params.organization,
    createdBy: userId,
    studentId: finalStudentId,
    userId: finalUserId,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight schedule request created successfully',
    data: {
      request: populatedRequest
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }, { status: 201 });
}, FLIGHT_SCHEDULE_REQUEST_SECURITY_CONFIG);