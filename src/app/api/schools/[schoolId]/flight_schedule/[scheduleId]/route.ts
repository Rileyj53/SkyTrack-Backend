import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import FlightSchedule from '@/models/FlightSchedule';
import mongoose from 'mongoose';

// GET /api/schools/[schoolId]/flight_schedule/[scheduleId] - Get a specific flight schedule
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string; scheduleId: string } }
) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if ('error' in apiKeyResult) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 });
    }

    // Authenticate user
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Connect to database
    await connectDB();

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or schedule ID format' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Flight schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ schedule });

  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/flight_schedule/[scheduleId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId]/flight_schedule/[scheduleId] - Update a specific flight schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string; scheduleId: string } }
) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if ('error' in apiKeyResult) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 });
    }

    // Authenticate user
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Connect to database
    await connectDB();

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or schedule ID format' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json();

    // Find existing schedule
    const existingSchedule = await (FlightSchedule as any).findOne({
      _id: params.scheduleId,
      school_id: params.schoolId
    });

    if (!existingSchedule) {
      return NextResponse.json(
        { error: 'Flight schedule not found' },
        { status: 404 }
      );
    }

    // Validate ObjectId fields if provided
    const objectIdFields = ['plane_id', 'instructor_id', 'student_id'];
    for (const field of objectIdFields) {
      if (body[field] && !mongoose.Types.ObjectId.isValid(body[field])) {
        return NextResponse.json(
          { error: `Invalid ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate date fields if provided
    let scheduledStartTime, scheduledEndTime;
    if (body.scheduled_start_time || body.scheduled_end_time) {
      scheduledStartTime = body.scheduled_start_time ? new Date(body.scheduled_start_time) : existingSchedule.scheduled_start_time;
      scheduledEndTime = body.scheduled_end_time ? new Date(body.scheduled_end_time) : existingSchedule.scheduled_end_time;
      
      if (isNaN(scheduledStartTime.getTime()) || isNaN(scheduledEndTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid scheduled_start_time or scheduled_end_time format' },
          { status: 400 }
        );
      }

      if (scheduledStartTime >= scheduledEndTime) {
        return NextResponse.json(
          { error: 'Scheduled end time must be after scheduled start time' },
          { status: 400 }
        );
      }
    }

    // Validate actual time fields if provided (optional)
    let actualStartTime, actualEndTime;
    if (body.actual_start_time) {
      actualStartTime = new Date(body.actual_start_time);
      if (isNaN(actualStartTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid actual_start_time format' },
          { status: 400 }
        );
      }
    }
    
    if (body.actual_end_time) {
      actualEndTime = new Date(body.actual_end_time);
      if (isNaN(actualEndTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid actual_end_time format' },
          { status: 400 }
        );
      }
    }
    
    // Validate that actual end time is after actual start time if both are provided
    const finalActualStartTime = actualStartTime || existingSchedule.actual_start_time;
    const finalActualEndTime = actualEndTime || existingSchedule.actual_end_time;
    if (finalActualStartTime && finalActualEndTime && finalActualStartTime >= finalActualEndTime) {
      return NextResponse.json(
        { error: 'Actual end time must be after actual start time' },
        { status: 400 }
      );
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
        return NextResponse.json(
          { error: 'Schedule conflict detected. The plane, instructor, or student is already scheduled during this time.' },
          { status: 409 }
        );
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
      return NextResponse.json(
        { error: 'Failed to update flight schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Flight schedule updated successfully',
      schedule: updatedSchedule
    });

  } catch (error) {
    console.error('Error in PUT /api/schools/[schoolId]/flight_schedule/[scheduleId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/flight_schedule/[scheduleId] - Delete a specific flight schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; scheduleId: string } }
) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if ('error' in apiKeyResult) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 });
    }

    // Authenticate user
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Connect to database
    await connectDB();

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or schedule ID format' },
        { status: 400 }
      );
    }

    // Get user role from token for permission check
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // Check if user has permission to delete (implement based on your business logic)
    if (!isSystemAdmin) {
      // Add additional permission checks here if needed
    }

    // Find and delete the flight schedule
    const deletedSchedule = await (FlightSchedule as any).findOneAndDelete({
      _id: params.scheduleId,
      school_id: params.schoolId
    });

    if (!deletedSchedule) {
      return NextResponse.json(
        { error: 'Flight schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Flight schedule deleted successfully',
      schedule_id: params.scheduleId
    });

  } catch (error) {
    console.error('Error in DELETE /api/schools/[schoolId]/flight_schedule/[scheduleId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 