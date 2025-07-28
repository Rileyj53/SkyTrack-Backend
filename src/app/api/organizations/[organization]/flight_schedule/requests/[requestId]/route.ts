import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import FlightScheduleRequest from '@/models/FlightScheduleRequest';
import FlightSchedule from '@/models/FlightSchedule';
import mongoose from 'mongoose';

// Security configuration for individual flight schedule request endpoints
const FLIGHT_SCHEDULE_REQUEST_ITEM_SECURITY_CONFIG: SecurityConfig = {
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

// GET /api/organizations/[organizationId]/flight_schedule/requests/[requestId] - Get a specific flight schedule request
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, requestId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule request detail request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    requestId: params.requestId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(params.requestId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID or request ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find the flight schedule request with populated data
  const scheduleRequest = await (FlightScheduleRequest as any)
    .findOne({
      _id: params.requestId,
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
    .populate({
      path: 'requested_by',
      select: 'first_name last_name email'
    })
    .populate({
      path: 'approved_by',
      select: 'first_name last_name email'
    })
    .lean();

  if (!scheduleRequest) {
    return NextResponse.json({
      error: {
        message: 'Flight schedule request not found',
        code: 'REQUEST_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Role-based access control
  const userRole = securityContext.user?.role;
  const userId = securityContext.user?.id;
  
  // Students can only see their own requests
  if (userRole === 'student') {
    if (scheduleRequest.requested_by._id.toString() !== userId) {
      return NextResponse.json({
        error: {
          message: 'Access denied: You can only view your own flight schedule requests',
          code: 'ACCESS_DENIED',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 403 });
    }
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight schedule request detail completed successfully',
    auditId: securityContext.auditId,
    requestId: params.requestId,
    userRole: userRole,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight schedule request retrieved successfully',
    data: {
      request: scheduleRequest
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_SCHEDULE_REQUEST_ITEM_SECURITY_CONFIG);

// PUT /api/organizations/[organizationId]/flight_schedule/requests/[requestId] - Update/approve/reject a flight schedule request
export const PUT = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, requestId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule request update',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    requestId: params.requestId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(params.requestId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID or request ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Role-based access control - only admins and instructors can approve/reject requests
  const userRole = securityContext.user?.role;
  const userId = securityContext.user?.id;
  
  if (!['sys_admin', 'school_admin', 'instructor'].includes(userRole)) {
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to update flight schedule requests',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Get request body
  const body = await request.json();

  // Find existing request
  const existingRequest = await (FlightScheduleRequest as any).findOne({
    _id: params.requestId,
    organization_id: params.organization
  });

  if (!existingRequest) {
    return NextResponse.json({
      error: {
        message: 'Flight schedule request not found',
        code: 'REQUEST_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Check if request is already processed
  if (existingRequest.status !== 'pending') {
    return NextResponse.json({
      error: {
        message: `Flight schedule request has already been ${existingRequest.status}`,
        code: 'REQUEST_ALREADY_PROCESSED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate status if provided
  if (body.status && !['pending', 'approved', 'rejected'].includes(body.status)) {
    return NextResponse.json({
      error: {
        message: 'Invalid status. Must be pending, approved, or rejected',
        code: 'INVALID_STATUS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // If approving the request, check for conflicts again
  if (body.status === 'approved') {
    const scheduleConflict = await (FlightSchedule as any).findOne({
      organization_id: params.organization,
      $or: [
        { student_id: existingRequest.student_id },
        { plane_id: existingRequest.plane_id },
        ...(existingRequest.instructor_id ? [{ instructor_id: existingRequest.instructor_id }] : [])
      ],
      $and: [
        { scheduled_start_time: { $lt: existingRequest.scheduled_end_time } },
        { scheduled_end_time: { $gt: existingRequest.scheduled_start_time } }
      ],
      status: { $nin: ['canceled', 'completed'] }
    }).lean();

    if (scheduleConflict) {
      return NextResponse.json({
        error: {
          message: 'Cannot approve: conflict detected with existing scheduled flight',
          code: 'APPROVAL_CONFLICT',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 409 });
    }

    // Create actual flight schedule when approving
    const flightSchedule = new FlightSchedule({
      organization_id: existingRequest.organization_id,
      plane_id: existingRequest.plane_id,
      instructor_id: existingRequest.instructor_id || undefined,
      student_id: existingRequest.student_id,
      scheduled_start_time: existingRequest.scheduled_start_time,
      scheduled_end_time: existingRequest.scheduled_end_time,
      flight_type: existingRequest.flight_type,
      status: 'scheduled',
      notes: body.admin_notes || existingRequest.request_notes,
      // Add approval tracking fields
      request_id: existingRequest._id,
      approved_by: userId,
      approved_at: new Date(),
      request_notes: existingRequest.request_notes
    });

    await flightSchedule.save();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Flight schedule created from approved request',
      auditId: securityContext.auditId,
      requestId: params.requestId,
      scheduleId: flightSchedule._id,
      timestamp: new Date().toISOString()
    }));
  }

  // Update the request
  const updateData: any = {
    ...(body.status && { status: body.status }),
    ...(body.admin_notes && { admin_notes: body.admin_notes }),
    ...(body.status !== 'pending' && { approved_by: userId })
  };

  const updatedRequest = await (FlightScheduleRequest as any).findByIdAndUpdate(
    params.requestId,
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
  .populate({
    path: 'requested_by',
    select: 'first_name last_name email'
  })
  .populate({
    path: 'approved_by',
    select: 'first_name last_name email'
  })
  .lean();

  if (!updatedRequest) {
    return NextResponse.json({
      error: {
        message: 'Failed to update flight schedule request',
        code: 'UPDATE_FAILED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight schedule request updated successfully',
    auditId: securityContext.auditId,
    requestId: params.requestId,
    newStatus: body.status,
    updatedBy: userId,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight schedule request updated successfully',
    data: {
      request: updatedRequest
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_SCHEDULE_REQUEST_ITEM_SECURITY_CONFIG);

// DELETE /api/organizations/[organizationId]/flight_schedule/requests/[requestId] - Delete a flight schedule request
export const DELETE = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, requestId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight schedule request deletion',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    requestId: params.requestId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(params.requestId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID or request ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Role-based access control - students can delete their own pending requests, admins can delete any
  const userRole = securityContext.user?.role;
  const userId = securityContext.user?.id;
  
  let deleteFilter: any = {
    _id: params.requestId,
    organization_id: params.organization
  };

  // Students can only delete their own pending requests
  if (userRole === 'student') {
    deleteFilter.requested_by = userId;
    deleteFilter.status = 'pending';
  } else if (!['sys_admin', 'school_admin'].includes(userRole)) {
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to delete flight schedule requests',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Find and delete the flight schedule request
  const deletedRequest = await (FlightScheduleRequest as any).findOneAndDelete(deleteFilter);

  if (!deletedRequest) {
    return NextResponse.json({
      error: {
        message: 'Flight schedule request not found or cannot be deleted',
        code: 'REQUEST_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight schedule request deleted successfully',
    auditId: securityContext.auditId,
    requestId: params.requestId,
    deletedBy: userId,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight schedule request deleted successfully',
    data: {
      request_id: params.requestId
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_SCHEDULE_REQUEST_ITEM_SECURITY_CONFIG);