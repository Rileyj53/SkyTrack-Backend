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
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET /api/organizations/[organizationId]/flight_schedule/[scheduleId] - Get a specific flight schedule
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, scheduleId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule detail request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    scheduleId: params.scheduleId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID or schedule ID format provided',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      scheduleId: params.scheduleId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID or schedule ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find the flight schedule with populated data (still using organization_id in database for now)
  const schedule = await (FlightSchedule as any)
    .findOne({
      _id: params.scheduleId,
      organization_id: params.organization
    })
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
    .lean();

  if (!schedule) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Flight schedule not found after populate',
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

// PUT /api/organizations/[organizationId]/flight_schedule/[scheduleId] - Update a specific flight schedule
export const PUT = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, scheduleId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule update request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    scheduleId: params.scheduleId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID or schedule ID format provided for update',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      scheduleId: params.scheduleId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID or schedule ID format',
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

  // Find existing schedule (still using organization_id in database for now)
  const existingSchedule = await (FlightSchedule as any).findOne({
    _id: params.scheduleId,
    organization_id: params.organization
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

  // Validate ObjectId fields if provided with specific messages
  const objectIdFieldMessages = {
    'plane_id': 'Invalid aircraft ID - please select a valid aircraft',
    'instructor_id': 'Invalid instructor ID - please select a valid instructor',
    'student_id': 'Invalid student ID - please select a valid student'
  };
  
  for (const [field, message] of Object.entries(objectIdFieldMessages)) {
    if (body[field] && !mongoose.Types.ObjectId.isValid(body[field])) {
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

  // Validate date fields if provided
  let scheduledStartTime, scheduledEndTime;
  if (body.scheduled_start_time || body.scheduled_end_time) {
    scheduledStartTime = body.scheduled_start_time ? new Date(body.scheduled_start_time) : existingSchedule.scheduled_start_time;
    scheduledEndTime = body.scheduled_end_time ? new Date(body.scheduled_end_time) : existingSchedule.scheduled_end_time;
    
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
    const actualDuration = Math.round((finalActualEndTime.getTime() - finalActualStartTime.getTime()) / (1000 * 60));
    return NextResponse.json({
      error: {
        message: `Actual flight end time must be after start time. Current actual duration is ${actualDuration} minutes (negative).`,
        code: 'INVALID_ACTUAL_TIME_RANGE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Check for scheduling conflicts with specific error messages (exclude current schedule) (still using organization_id in database for now)
  if (body.scheduled_start_time || body.scheduled_end_time || body.plane_id || body.instructor_id || body.student_id) {
    const finalScheduledStartTime = scheduledStartTime || existingSchedule.scheduled_start_time;
    const finalScheduledEndTime = scheduledEndTime || existingSchedule.scheduled_end_time;
    
    const timeFilter = {
      organization_id: params.organization,
      _id: { $ne: params.scheduleId }, // Exclude current schedule
      $and: [
        { scheduled_start_time: { $lt: finalScheduledEndTime } },
        { scheduled_end_time: { $gt: finalScheduledStartTime } }
      ],
      status: { $nin: ['canceled', 'completed'] }
    };

    // Check for plane conflict
    const finalPlaneId = body.plane_id || existingSchedule.plane_id;
    const planeConflict = await (FlightSchedule as any)
      .findOne({
        ...timeFilter,
        plane_id: finalPlaneId
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
        message: 'Aircraft conflict detected during update',
        auditId: securityContext.auditId,
        conflictingScheduleId: planeConflict._id,
        scheduleId: params.scheduleId,
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
    const finalStudentId = body.student_id || existingSchedule.student_id;
    const studentConflict = await (FlightSchedule as any)
      .findOne({
        ...timeFilter,
        student_id: finalStudentId
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
        message: 'Student conflict detected during update',
        auditId: securityContext.auditId,
        conflictingScheduleId: studentConflict._id,
        scheduleId: params.scheduleId,
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
    const finalInstructorId = body.instructor_id || existingSchedule.instructor_id;
    if (finalInstructorId) {
      const instructorConflict = await (FlightSchedule as any)
        .findOne({
          ...timeFilter,
          instructor_id: finalInstructorId
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
          message: 'Instructor conflict detected during update',
          auditId: securityContext.auditId,
          conflictingScheduleId: instructorConflict._id,
          scheduleId: params.scheduleId,
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
  }

  // Prepare update object with proper time handling for duration calculation
  const updateData = { ...body };
  
  // Sanitize ObjectId fields - convert empty strings to null
  const updateObjectIdFields = ['instructor_id', 'student_id', 'plane_id'];
  updateObjectIdFields.forEach(field => {
    if (updateData[field] === '' || updateData[field] === undefined) {
      updateData[field] = null;
    }
  });
  
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

// DELETE /api/organizations/[organizationId]/flight_schedule/[scheduleId] - Delete a specific flight schedule
export const DELETE = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, scheduleId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule deletion request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    scheduleId: params.scheduleId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID or schedule ID format provided for deletion',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      scheduleId: params.scheduleId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID or schedule ID format',
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

  // Find and delete the flight schedule (still using organization_id in database for now)
  const deletedSchedule = await (FlightSchedule as any).findOneAndDelete({
    _id: params.scheduleId,
    organization_id: params.organization
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