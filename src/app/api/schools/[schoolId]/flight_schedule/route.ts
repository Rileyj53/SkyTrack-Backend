import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import FlightSchedule from '@/models/FlightSchedule';
import Student from '@/models/Student';
import Instructor from '@/models/Instructor';
import mongoose from 'mongoose';

// Security configuration for flight schedule endpoints
const FLIGHT_SCHEDULE_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // Required for POST operations
  allowedRoles: ['sys_admin', 'school_admin', 'instructor', 'student'],
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

// GET /api/schools/[schoolId]/flight_schedule - List all flight schedules for a school
export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule list request',
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

  // Role-based access control
  const userRole = securityContext.user?.role;
  const userId = securityContext.user?.id;
  
  // Students can only see their own schedules
  let additionalFilter = {};
  if (userRole === 'student') {
    // Find student record to get student ID
    const studentRecord = await (Student as any).findOne({ user_id: userId }).lean();
    if (!studentRecord) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Student record not found for authenticated user',
        auditId: securityContext.auditId,
        userId: userId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Student record not found',
          code: 'STUDENT_NOT_FOUND',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }
    additionalFilter = { student_id: studentRecord._id };
  }
  
  // Instructors can see schedules they're assigned to
  if (userRole === 'instructor') {
    const instructorRecord = await (Instructor as any).findOne({ user_id: userId }).lean();
    if (!instructorRecord) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Instructor record not found for authenticated user',
        auditId: securityContext.auditId,
        userId: userId,
        timestamp: new Date().toISOString()
      }));
      
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
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100); // Cap at 100
  const status = url.searchParams.get('status');
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  const planeId = url.searchParams.get('plane_id');
  const instructorId = url.searchParams.get('instructor_id');
  const studentId = url.searchParams.get('student_id');
  const sortField = url.searchParams.get('sortField') || 'scheduled_start_time';
  const sortDirection = url.searchParams.get('sortDirection') || 'asc';
  const statusOrder = url.searchParams.get('statusOrder') || 'In-progress,Scheduled,Completed,Canceled';

  // Build filter object
  const filter: any = { 
    school_id: params.schoolId,
    ...additionalFilter
  };
  
  if (status) filter.status = status;
  if (planeId && mongoose.Types.ObjectId.isValid(planeId)) filter.plane_id = planeId;
  if (instructorId && mongoose.Types.ObjectId.isValid(instructorId)) filter.instructor_id = instructorId;
  if (studentId && mongoose.Types.ObjectId.isValid(studentId)) filter.student_id = studentId;
  
  if (startDate || endDate) {
    filter.scheduled_start_time = {};
    if (startDate) {
      const startOfDay = new Date(startDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      startOfDay.setUTCDate(startOfDay.getUTCDate() - 1);
      filter.scheduled_start_time.$gte = startOfDay;
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
      filter.scheduled_start_time.$lte = endOfDay;
    }
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Create status order array for sorting
  const statusOrderArray = statusOrder.split(',').map(s => s.trim());

  // Get flight schedules with populated data
  const allSchedules = await (FlightSchedule as any)
    .find(filter)
    .populate({
      path: 'school_id',
      select: 'name address airport phone email'
    })
    .populate({
      path: 'plane_id',
      select: 'registration type aircraftModel status'
    })
    .populate({
      path: 'instructor_id',
      populate: {
        path: 'user_id',
        select: 'first_name last_name email'
      }
    })
    .populate({
      path: 'student_id',
      populate: {
        path: 'user_id',
        select: 'first_name last_name email'
      }
    })
    .lean();

  // Sort the results according to custom status order and then by time
  const sortedSchedules = allSchedules.sort((a: any, b: any) => {
    // First sort by status order (case-insensitive)
    const statusOrderA = statusOrderArray.findIndex(status => 
      status.toLowerCase() === a.status.toLowerCase()
    );
    const statusOrderB = statusOrderArray.findIndex(status => 
      status.toLowerCase() === b.status.toLowerCase()
    );
    
    const orderA = statusOrderA === -1 ? 999 : statusOrderA;
    const orderB = statusOrderB === -1 ? 999 : statusOrderB;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // If status is the same, sort by the specified field
    const fieldA = a[sortField];
    const fieldB = b[sortField];
    
    if (sortField.includes('time') && fieldA && fieldB) {
      const timeA = new Date(fieldA).getTime();
      const timeB = new Date(fieldB).getTime();
      return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
    }
    
    // For non-time fields, do string comparison
    if (fieldA < fieldB) return sortDirection === 'asc' ? -1 : 1;
    if (fieldA > fieldB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Apply pagination to sorted results
  const schedules = sortedSchedules.slice(skip, skip + limit);

  // Get total count for pagination
  const total = await FlightSchedule.countDocuments(filter);

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight schedule list request completed successfully',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    userRole: userRole,
    schedulesReturned: schedules.length,
    totalSchedules: total,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight schedules retrieved successfully',
    data: {
      schedules,
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
}, FLIGHT_SCHEDULE_SECURITY_CONFIG);

// POST /api/schools/[schoolId]/flight_schedule - Create a new flight schedule
export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule creation request',
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
      message: 'Invalid school ID format provided for schedule creation',
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

  // Role-based access control - only admins and instructors can create schedules
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin', 'instructor'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to create flight schedule',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to create flight schedules',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Get request body
  const body = await request.json();

  // Validate required fields
  const requiredFields = ['plane_id', 'student_id', 'scheduled_start_time', 'scheduled_end_time', 'flight_type'];
  for (const field of requiredFields) {
    if (!body[field]) {
      return NextResponse.json({
        error: {
          message: `${field} is required`,
          code: 'MISSING_REQUIRED_FIELD',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
  }

  // Validate ObjectId fields (instructor_id is optional)
  const objectIdFields = ['plane_id', 'student_id'];
  for (const field of objectIdFields) {
    if (!mongoose.Types.ObjectId.isValid(body[field])) {
      return NextResponse.json({
        error: {
          message: `Invalid ${field}`,
          code: 'INVALID_OBJECT_ID',
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
        message: 'Invalid instructor_id',
        code: 'INVALID_INSTRUCTOR_ID',
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
        message: 'Invalid scheduled_start_time or scheduled_end_time format',
        code: 'INVALID_DATE_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  if (scheduledStartTime >= scheduledEndTime) {
    return NextResponse.json({
      error: {
        message: 'Scheduled end time must be after scheduled start time',
        code: 'INVALID_TIME_RANGE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate actual time fields if provided (optional)
  let actualStartTime, actualEndTime;
  if (body.actual_start_time) {
    actualStartTime = new Date(body.actual_start_time);
    if (isNaN(actualStartTime.getTime())) {
      return NextResponse.json({
        error: {
          message: 'Invalid actual_start_time format',
          code: 'INVALID_ACTUAL_START_TIME',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
  }
  
  if (body.actual_end_time) {
    actualEndTime = new Date(body.actual_end_time);
    if (isNaN(actualEndTime.getTime())) {
      return NextResponse.json({
        error: {
          message: 'Invalid actual_end_time format',
          code: 'INVALID_ACTUAL_END_TIME',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
  }
  
  // Validate that actual end time is after actual start time if both are provided
  if (actualStartTime && actualEndTime && actualStartTime >= actualEndTime) {
    return NextResponse.json({
      error: {
        message: 'Actual end time must be after actual start time',
        code: 'INVALID_ACTUAL_TIME_RANGE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Check for scheduling conflicts
  const conflictConditions: Array<{ [key: string]: any }> = [
    { plane_id: body.plane_id },
    { student_id: body.student_id }
  ];
  
  // Only add instructor conflict check if instructor_id is provided
  if (body.instructor_id) {
    conflictConditions.push({ instructor_id: body.instructor_id });
  }

  const conflictFilter = {
    school_id: params.schoolId,
    $or: conflictConditions,
    $and: [
      { scheduled_start_time: { $lt: scheduledEndTime } },
      { scheduled_end_time: { $gt: scheduledStartTime } }
    ],
    status: { $nin: ['canceled', 'completed'] }
  };

  const existingSchedule = await (FlightSchedule as any).findOne(conflictFilter);
  if (existingSchedule) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Schedule conflict detected during creation',
      auditId: securityContext.auditId,
      conflictingScheduleId: existingSchedule._id,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Schedule conflict detected. The plane, instructor, or student is already scheduled during this time.',
        code: 'SCHEDULE_CONFLICT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 409 });
  }

  // Create new flight schedule
  const flightSchedule = new FlightSchedule({
    school_id: params.schoolId,
    plane_id: body.plane_id,
    instructor_id: body.instructor_id || undefined, // Only set if provided
    student_id: body.student_id,
    scheduled_start_time: scheduledStartTime,
    scheduled_end_time: scheduledEndTime,
    actual_start_time: actualStartTime || null,
    actual_end_time: actualEndTime || null,
    flight_type: body.flight_type,
    status: body.status || 'scheduled',
    notes: body.notes
    // scheduled_duration and actual_duration will be calculated automatically by the pre-save middleware
  });

  await flightSchedule.save();

  // Populate the created schedule with related data
  const populatedSchedule = await (FlightSchedule as any)
    .findById(flightSchedule._id)
    .populate({
      path: 'school_id',
      select: 'name address airport phone email'
    })
    .populate({
      path: 'plane_id',
      select: 'registration type aircraftModel status'
    })
    .populate({
      path: 'instructor_id',
      populate: {
        path: 'user_id',
        select: 'first_name last_name email'
      }
    })
    .populate({
      path: 'student_id',
      populate: {
        path: 'user_id',
        select: 'first_name last_name email'
      }
    })
    .lean();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight schedule created successfully',
    auditId: securityContext.auditId,
    scheduleId: flightSchedule._id,
    schoolId: params.schoolId,
    createdBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight schedule created successfully',
    data: {
      schedule: populatedSchedule
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }, { status: 201 });
}, FLIGHT_SCHEDULE_SECURITY_CONFIG); 