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
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin', 'instructor', 'student', 'mechanic', 'member'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET /api/organizations/[organizationId]/flight_schedule - List all flight schedules for an organization
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule list request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate organization ID
  if (!mongoose.Types.ObjectId.isValid(params.organization)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID format provided',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
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
  const filterUserId = url.searchParams.get('user_id'); // New user_id filter parameter
  const search = url.searchParams.get('search'); // New search parameter
  const sortField = url.searchParams.get('sortField') || 'scheduled_start_time';
  const sortDirection = url.searchParams.get('sortDirection') || 'asc';
  const statusOrder = url.searchParams.get('statusOrder') || 'In-progress,Scheduled,Completed,Canceled';

  // Build filter object (still using organization_id in database for now)
  const filter: any = { 
    organization_id: params.organization,
    ...additionalFilter
  };
  
  if (status) filter.status = status;
  if (planeId && mongoose.Types.ObjectId.isValid(planeId)) filter.plane_id = planeId;
  if (instructorId && mongoose.Types.ObjectId.isValid(instructorId)) filter.instructor_id = instructorId;
  if (studentId && mongoose.Types.ObjectId.isValid(studentId)) filter.student_id = studentId;
  
  // Handle user_id filter - find schedules where user is either student or instructor
  if (filterUserId && mongoose.Types.ObjectId.isValid(filterUserId)) {
    // First, find the student and instructor records for this user
    const studentRecord = await (Student as any).findOne({ user_id: filterUserId }).lean();
    const instructorRecord = await (Instructor as any).findOne({ user_id: filterUserId }).lean();
    
    // Build OR condition for user_id filter
    const userFilterConditions = [];
    
    if (studentRecord) {
      userFilterConditions.push({ student_id: studentRecord._id });
    }
    
    if (instructorRecord) {
      userFilterConditions.push({ instructor_id: instructorRecord._id });
    }
    
    // If we found either student or instructor records, apply the filter
    if (userFilterConditions.length > 0) {
      if (userFilterConditions.length === 1) {
        // Single condition
        Object.assign(filter, userFilterConditions[0]);
      } else {
        // Multiple conditions - use $or
        filter.$or = userFilterConditions;
      }
    } else {
      // User not found as student or instructor - return empty results
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'User not found as student or instructor for user_id filter',
        auditId: securityContext.auditId,
        userId: filterUserId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        success: true,
        message: 'No flight schedules found for this user',
        data: {
          schedules: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
            statusCounts: {
              current: 0,
              scheduled: 0,
              completed: 0,
              canceled: 0
            }
          },
          search: null
        },
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      });
    }
  }
  
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

  // Create status order array for sorting
  const statusOrderArray = statusOrder.split(',').map(s => s.trim());

  // Get flight schedules with populated data
  const allSchedules = await (FlightSchedule as any)
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
      path: 'request_id',
      select: 'status request_notes admin_notes created_at'
    })
    .lean();

  // Manually populate approved_by field if it exists in the schema
  // This avoids the strictPopulateError when the field might not exist in all documents
  const schedulesWithApprovedBy = allSchedules.map((schedule: any) => {
    if (schedule.approved_by) {
      // If approved_by exists, we'll handle it separately to avoid populate errors
      // For now, we'll just keep the ObjectId reference
      return schedule;
    }
    return schedule;
  });

  // Apply search filter if search parameter is provided
  let filteredSchedules = schedulesWithApprovedBy;
  if (search && search.trim()) {
    const searchTerm = search.toLowerCase().trim();
    
    filteredSchedules = filteredSchedules.filter((schedule: any) => {
      // Search in flight schedule fields
      const scheduleFields = [
        schedule.flight_type,
        schedule.status,
        schedule.notes
      ].filter(Boolean).join(' ').toLowerCase();
      
      // Search in plane information
      const planeFields = schedule.plane_id ? [
        schedule.plane_id.registration,
        schedule.plane_id.type,
        schedule.plane_id.aircraftModel,
        schedule.plane_id.status
      ].filter(Boolean).join(' ').toLowerCase() : '';
      
      // Search in instructor information
      const instructorFields = schedule.instructor_id ? [
        schedule.instructor_id.contact_email,
        schedule.instructor_id.status,
        schedule.instructor_id.flightHours?.toString(),
        schedule.instructor_id.user_id?.first_name,
        schedule.instructor_id.user_id?.last_name,
        schedule.instructor_id.user_id?.email
      ].filter(Boolean).join(' ').toLowerCase() : '';
      
      // Search in student information
      const studentFields = schedule.student_id ? [
        schedule.student_id.contact_email,
        schedule.student_id.program,
        schedule.student_id.status,
        schedule.student_id.enrollmentDate,
        schedule.student_id.user_id?.first_name,
        schedule.student_id.user_id?.last_name,
        schedule.student_id.user_id?.email
      ].filter(Boolean).join(' ').toLowerCase() : '';
      
      // Search in organization information
      const organizationFields = schedule.organization_id ? [
        schedule.organization_id.name,
        schedule.organization_id.address,
        schedule.organization_id.airport,
        schedule.organization_id.phone,
        schedule.organization_id.email
      ].filter(Boolean).join(' ').toLowerCase() : '';
      
      // Combine all searchable fields
      const allSearchableText = [
        scheduleFields,
        planeFields,
        instructorFields,
        studentFields,
        organizationFields
      ].join(' ');
      
      return allSearchableText.includes(searchTerm);
    });
  }

  // Sort the results according to custom status order and then by time
  const sortedSchedules = filteredSchedules.sort((a: any, b: any) => {
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

  // Get total count for pagination (after search filtering)
  const total = filteredSchedules.length;

  // Calculate status counts for the filtered results
  const statusCounts = {
    current: 0,    // "in-progress"
    scheduled: 0,  // "scheduled"
    completed: 0,  // "completed"
    canceled: 0    // "canceled" or "no-show"
  };

  filteredSchedules.forEach((schedule: any) => {
    const status = schedule.status?.toLowerCase();
    switch (status) {
      case 'in-progress':
        statusCounts.current++;
        break;
      case 'scheduled':
        statusCounts.scheduled++;
        break;
      case 'completed':
        statusCounts.completed++;
        break;
      case 'canceled':
      case 'no-show':
        statusCounts.canceled++;
        break;
    }
  });

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight schedule list request completed successfully',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userRole: userRole,
    searchTerm: search || null,
    filterUserId: filterUserId || null,
    schedulesReturned: schedules.length,
    totalSchedules: total,
    originalTotal: allSchedules.length,
    statusCounts: statusCounts,
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
        pages: Math.ceil(total / limit),
        statusCounts
      },
      search: search ? {
        term: search,
        resultsFound: total,
        originalTotal: allSchedules.length
      } : null
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_SCHEDULE_SECURITY_CONFIG);

// POST /api/organizations/[organizationId]/flight_schedule - Create a new flight schedule
export const POST = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule creation request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate organization ID
  if (!mongoose.Types.ObjectId.isValid(params.organization)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID format provided for schedule creation',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID format',
        code: 'INVALID_ORGANIZATION_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Role-based access control - only admins and instructors can create schedules directly
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin', 'instructor'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to create flight schedule',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    const message = userRole === 'student' 
      ? 'Students must use the flight schedule request system. Please create a request at /flight_schedule/requests instead.'
      : 'Insufficient permissions to create flight schedules directly';
    
    return NextResponse.json({
      error: {
        message: message,
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Get request body
  const body = await request.json();

  // Validate required fields with specific messages
  const requiredFieldMessages = {
    'plane_id': 'Aircraft selection is required',
    'student_id': 'Student selection is required', 
    'scheduled_start_time': 'Scheduled start time is required',
    'scheduled_end_time': 'Scheduled end time is required'
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

  // Validate ObjectId fields with specific messages
  const objectIdFieldMessages = {
    'plane_id': 'Invalid aircraft ID - please select a valid aircraft',
    'student_id': 'Invalid student ID - please select a valid student'
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
        message: 'Invalid instructor ID - please select a valid instructor',
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
        message: 'Invalid date format - please use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
        code: 'INVALID_DATE_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  if (scheduledStartTime >= scheduledEndTime) {
    const duration = Math.round((scheduledEndTime.getTime() - scheduledStartTime.getTime()) / (1000 * 60));
    return NextResponse.json({
      error: {
        message: `Flight end time must be after start time. Current duration is ${duration} minutes (negative).`,
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

  // Check for scheduling conflicts with specific error messages (still using organization_id in database for now)
  const timeFilter = {
    $and: [
      { scheduled_start_time: { $lt: scheduledEndTime } },
      { scheduled_end_time: { $gt: scheduledStartTime } }
    ],
    status: { $nin: ['canceled', 'completed'] }
  };

  // Check for plane conflict
  const planeConflict = await (FlightSchedule as any)
    .findOne({
      organization_id: params.organization,
      plane_id: body.plane_id,
      ...timeFilter
    })
    .populate('plane_id', 'registration aircraftModel')
    .lean();

  if (planeConflict) {
    const conflictStart = new Date(planeConflict.scheduled_start_time).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      timeZone: 'UTC' 
    });
    const conflictEnd = new Date(planeConflict.scheduled_end_time).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      timeZone: 'UTC' 
    });
    
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Aircraft conflict detected during creation',
      auditId: securityContext.auditId,
      conflictingScheduleId: planeConflict._id,
      aircraft: planeConflict.plane_id?.registration,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: `Aircraft ${planeConflict.plane_id?.registration || 'Unknown'} (${planeConflict.plane_id?.aircraftModel || 'Unknown Model'}) is already scheduled from ${conflictStart} to ${conflictEnd}`,
        code: 'AIRCRAFT_CONFLICT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        conflictDetails: {
          type: 'aircraft',
          resource: planeConflict.plane_id?.registration,
          conflictStart: planeConflict.scheduled_start_time,
          conflictEnd: planeConflict.scheduled_end_time,
          conflictingScheduleId: planeConflict._id
        }
      }
    }, { status: 409 });
  }

  // Check for student conflict
  const studentConflict = await (FlightSchedule as any)
    .findOne({
      organization_id: params.organization,
      student_id: body.student_id,
      ...timeFilter
    })
    .populate({
      path: 'student_id',
      model: 'Student', // Explicitly specify model
      populate: {
        path: 'user_id',
        model: 'User',
        select: 'first_name last_name'
      }
    })
    .lean();

  if (studentConflict) {
    const conflictStart = new Date(studentConflict.scheduled_start_time).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      timeZone: 'UTC' 
    });
    const conflictEnd = new Date(studentConflict.scheduled_end_time).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      timeZone: 'UTC' 
    });
    
    const studentName = studentConflict.student_id?.user_id ? 
      `${studentConflict.student_id.user_id.first_name} ${studentConflict.student_id.user_id.last_name}` : 
      'Unknown Student';
    
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Student conflict detected during creation',
      auditId: securityContext.auditId,
      conflictingScheduleId: studentConflict._id,
      student: studentName,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: `Student ${studentName} is already scheduled for a flight from ${conflictStart} to ${conflictEnd}`,
        code: 'STUDENT_CONFLICT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        conflictDetails: {
          type: 'student',
          resource: studentName,
          conflictStart: studentConflict.scheduled_start_time,
          conflictEnd: studentConflict.scheduled_end_time,
          conflictingScheduleId: studentConflict._id
        }
      }
    }, { status: 409 });
  }

  // Check for instructor conflict (only if instructor is provided)
  if (body.instructor_id) {
    const instructorConflict = await (FlightSchedule as any)
      .findOne({
        organization_id: params.organization,
        instructor_id: body.instructor_id,
        ...timeFilter
      })
      .populate({
        path: 'instructor_id',
        model: 'Instructor', // Explicitly specify model
        populate: {
          path: 'user_id',
          model: 'User',
          select: 'first_name last_name'
        }
      })
      .lean();

    if (instructorConflict) {
      const conflictStart = new Date(instructorConflict.scheduled_start_time).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        timeZone: 'UTC' 
      });
      const conflictEnd = new Date(instructorConflict.scheduled_end_time).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        timeZone: 'UTC' 
      });
      
      const instructorName = instructorConflict.instructor_id?.user_id ? 
        `${instructorConflict.instructor_id.user_id.first_name} ${instructorConflict.instructor_id.user_id.last_name}` : 
        'Unknown Instructor';
      
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Instructor conflict detected during creation',
        auditId: securityContext.auditId,
        conflictingScheduleId: instructorConflict._id,
        instructor: instructorName,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: `Instructor ${instructorName} is already scheduled for a flight from ${conflictStart} to ${conflictEnd}`,
          code: 'INSTRUCTOR_CONFLICT',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString(),
          conflictDetails: {
            type: 'instructor',
            resource: instructorName,
            conflictStart: instructorConflict.scheduled_start_time,
            conflictEnd: instructorConflict.scheduled_end_time,
            conflictingScheduleId: instructorConflict._id
          }
        }
      }, { status: 409 });
    }
  }

  // Create new flight schedule (still using organization_id in database for now)
  const flightScheduleData: any = {
    organization_id: params.organization,
    plane_id: body.plane_id,
    instructor_id: body.instructor_id || undefined, // Only set if provided
    student_id: body.student_id,
    scheduled_start_time: scheduledStartTime,
    scheduled_end_time: scheduledEndTime,
    actual_start_time: actualStartTime || null,
    actual_end_time: actualEndTime || null,
    status: body.status || 'scheduled',
    notes: body.notes
    // scheduled_duration and actual_duration will be calculated automatically by the pre-save middleware
  };

  // Only add flight_type if it's provided
  if (body.flight_type) {
    flightScheduleData.flight_type = body.flight_type;
  }

  const flightSchedule = new FlightSchedule(flightScheduleData);

  await flightSchedule.save();

  // Populate the created schedule with related data
  const populatedSchedule = await (FlightSchedule as any)
    .findById(flightSchedule._id)
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
      path: 'approved_by',
      select: 'first_name last_name email'
    })
    .populate({
      path: 'request_id',
      select: 'status request_notes admin_notes created_at'
    })
    .lean();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight schedule created successfully',
    auditId: securityContext.auditId,
    scheduleId: flightSchedule._id,
    organizationId: params.organization,
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