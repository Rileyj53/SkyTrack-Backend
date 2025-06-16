import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import FlightSchedule from '@/models/FlightSchedule';
import mongoose from 'mongoose';

// Security configuration for individual flight schedule endpoints
const FLIGHT_SCHEDULE_ITEM_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // Required for PUT/DELETE operations
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

// GET /api/schools/[schoolId]/flight_schedule/[scheduleId] - Get a specific flight schedule
export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule detail request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    scheduleId: params.scheduleId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid school ID or schedule ID format provided',
      auditId: securityContext.auditId,
      schoolId: params.schoolId,
      scheduleId: params.scheduleId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid school ID or schedule ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find the flight schedule with populated data
  const schedule = await (FlightSchedule as any)
    .findOne({
      _id: params.scheduleId,
      school_id: params.schoolId
    })
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

  if (!schedule) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Flight schedule not found',
      auditId: securityContext.auditId,
      schoolId: params.schoolId,
      scheduleId: params.scheduleId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Flight schedule not found',
        code: 'SCHEDULE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Role-based access control
  const userRole = securityContext.user?.role;
  const userId = securityContext.user?.id;
  
  // Students can only see their own schedules
  if (userRole === 'student') {
    const studentUserId = schedule.student_id?.user_id?._id?.toString() || schedule.student_id?.user_id?.toString();
    if (studentUserId !== userId) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Student attempted to access schedule not assigned to them',
        auditId: securityContext.auditId,
        userId: userId,
        scheduleId: params.scheduleId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Access denied: You can only view your own flight schedules',
          code: 'ACCESS_DENIED',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 403 });
    }
  }
  
  // Instructors can only see schedules they're assigned to
  if (userRole === 'instructor') {
    const instructorUserId = schedule.instructor_id?.user_id?._id?.toString() || schedule.instructor_id?.user_id?.toString();
    if (instructorUserId !== userId) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Instructor attempted to access schedule not assigned to them',
        auditId: securityContext.auditId,
        userId: userId,
        scheduleId: params.scheduleId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Access denied: You can only view flight schedules assigned to you',
          code: 'ACCESS_DENIED',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 403 });
    }
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight schedule detail request completed successfully',
    auditId: securityContext.auditId,
    scheduleId: params.scheduleId,
    userRole: userRole,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight schedule retrieved successfully',
    data: {
      schedule
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_SCHEDULE_ITEM_SECURITY_CONFIG);

// PUT /api/schools/[schoolId]/flight_schedule/[scheduleId] - Update a specific flight schedule
export const PUT = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule update request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    scheduleId: params.scheduleId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid school ID or schedule ID format provided for update',
      auditId: securityContext.auditId,
      schoolId: params.schoolId,
      scheduleId: params.scheduleId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid school ID or schedule ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Role-based access control - only admins and instructors can update schedules
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin', 'instructor'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to update flight schedule',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      scheduleId: params.scheduleId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to update flight schedules',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Get request body
  const body = await request.json();

  // Find existing schedule
  const existingSchedule = await (FlightSchedule as any).findOne({
    _id: params.scheduleId,
    school_id: params.schoolId
  });

  if (!existingSchedule) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Flight schedule not found for update',
      auditId: securityContext.auditId,
      scheduleId: params.scheduleId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Flight schedule not found',
        code: 'SCHEDULE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Validate ObjectId fields if provided
  const objectIdFields = ['plane_id', 'instructor_id', 'student_id'];
  for (const field of objectIdFields) {
    if (body[field] && !mongoose.Types.ObjectId.isValid(body[field])) {
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

  // Validate date fields if provided
  let scheduledStartTime, scheduledEndTime;
  if (body.scheduled_start_time || body.scheduled_end_time) {
    scheduledStartTime = body.scheduled_start_time ? new Date(body.scheduled_start_time) : existingSchedule.scheduled_start_time;
    scheduledEndTime = body.scheduled_end_time ? new Date(body.scheduled_end_time) : existingSchedule.scheduled_end_time;
    
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
  const finalActualStartTime = actualStartTime || existingSchedule.actual_start_time;
  const finalActualEndTime = actualEndTime || existingSchedule.actual_end_time;
  if (finalActualStartTime && finalActualEndTime && finalActualStartTime >= finalActualEndTime) {
    return NextResponse.json({
      error: {
        message: 'Actual end time must be after actual start time',
        code: 'INVALID_ACTUAL_TIME_RANGE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Check for scheduling conflicts (exclude current schedule)
  if (body.scheduled_start_time || body.scheduled_end_time || body.plane_id || body.instructor_id || body.student_id) {
    const conflictConditions: Array<{ [key: string]: any }> = [
      { plane_id: body.plane_id || existingSchedule.plane_id },
      { student_id: body.student_id || existingSchedule.student_id }
    ];
    
    // Only add instructor conflict check if instructor_id is provided (either in update or existing)
    const instructorId = body.instructor_id || existingSchedule.instructor_id;
    if (instructorId) {
      conflictConditions.push({ instructor_id: instructorId });
    }

    const conflictFilter = {
      school_id: params.schoolId,
      _id: { $ne: params.scheduleId }, // Exclude current schedule
      $or: conflictConditions,
      $and: [
        { scheduled_start_time: { $lt: scheduledEndTime || existingSchedule.scheduled_end_time } },
        { scheduled_end_time: { $gt: scheduledStartTime || existingSchedule.scheduled_start_time } }
      ],
      status: { $nin: ['canceled', 'completed'] }
    };

    const existingConflict = await (FlightSchedule as any).findOne(conflictFilter);
    if (existingConflict) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Schedule conflict detected during update',
        auditId: securityContext.auditId,
        conflictingScheduleId: existingConflict._id,
        scheduleId: params.scheduleId,
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
  }

  // Prepare update object with proper time handling for duration calculation
  const updateData = { ...body };
  
  // If either scheduled time is being updated, ensure both are included for duration calculation
  if (body.scheduled_start_time || body.scheduled_end_time) {
    updateData.scheduled_start_time = scheduledStartTime || existingSchedule.scheduled_start_time;
    updateData.scheduled_end_time = scheduledEndTime || existingSchedule.scheduled_end_time;
  }
  
  // If either actual time is being updated, ensure both are included for duration calculation
  if (body.actual_start_time || body.actual_end_time) {
    updateData.actual_start_time = actualStartTime || existingSchedule.actual_start_time;
    updateData.actual_end_time = actualEndTime || existingSchedule.actual_end_time;
  }

  // Update the flight schedule
  const updatedSchedule = await (FlightSchedule as any).findByIdAndUpdate(
    params.scheduleId,
    { $set: updateData },
    { new: true, runValidators: true }
  )
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

  if (!updatedSchedule) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Failed to update flight schedule',
      auditId: securityContext.auditId,
      scheduleId: params.scheduleId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Failed to update flight schedule',
        code: 'UPDATE_FAILED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight schedule updated successfully',
    auditId: securityContext.auditId,
    scheduleId: params.scheduleId,
    updatedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight schedule updated successfully',
    data: {
      schedule: updatedSchedule
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_SCHEDULE_ITEM_SECURITY_CONFIG);

// DELETE /api/schools/[schoolId]/flight_schedule/[scheduleId] - Delete a specific flight schedule
export const DELETE = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule deletion request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    scheduleId: params.scheduleId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid school ID or schedule ID format provided for deletion',
      auditId: securityContext.auditId,
      schoolId: params.schoolId,
      scheduleId: params.scheduleId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid school ID or schedule ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Role-based access control - only sys_admin and school_admin can delete schedules
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to delete flight schedule',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      scheduleId: params.scheduleId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to delete flight schedules',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Find and delete the flight schedule
  const deletedSchedule = await (FlightSchedule as any).findOneAndDelete({
    _id: params.scheduleId,
    school_id: params.schoolId
  });

  if (!deletedSchedule) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Flight schedule not found for deletion',
      auditId: securityContext.auditId,
      scheduleId: params.scheduleId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Flight schedule not found',
        code: 'SCHEDULE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight schedule deleted successfully',
    auditId: securityContext.auditId,
    scheduleId: params.scheduleId,
    deletedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight schedule deleted successfully',
    data: {
      schedule_id: params.scheduleId
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_SCHEDULE_ITEM_SECURITY_CONFIG); 