import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import { checkSchoolAccess } from '@/middleware/schoolAccess';
import { verifyToken } from '@/lib/jwt';
import { Schedule, Pilot, User } from '@/models';
import { connectDB } from '@/lib/db';

// Connect to MongoDB
connectDB();

// GET /api/schools/[schoolId]/schedules/[scheduleId] - Get a specific schedule
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string; scheduleId: string } }
) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get user from token
    const auth = authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || 
        !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or schedule ID' },
        { status: 400 }
      );
    }

    // If not a system admin, check school access
    if (!isSystemAdmin) {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck) {
        return schoolAccessCheck;
      }
    }

    // Find the schedule
    const schedule = await (Schedule.findOne({
      _id: params.scheduleId,
      school_id: params.schoolId
    })
      .populate('student_id', 'first_name last_name')
      .populate('instructor_id', 'first_name last_name')
      .populate('plane_id', 'tail_number model')
      .populate('created_by', 'first_name last_name')
      .populate('last_updated_by', 'first_name last_name') as any).exec();
    
    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      schedule
    });
  } catch (error) {
    console.error('Error retrieving schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId]/schedules/[scheduleId] - Update a specific schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string; scheduleId: string } }
) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get user from token
    const auth = authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || 
        !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or schedule ID' },
        { status: 400 }
      );
    }

    // If not a system admin, check school access
    if (!isSystemAdmin) {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck) {
        return schoolAccessCheck;
      }
    }

    // Get request body
    const body = await request.json();
    
    // Find the schedule
    const schedule = await (Schedule.findOne({
      _id: params.scheduleId,
      school_id: params.schoolId
    }) as any).exec();
    
    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Validate student ID if provided
    if (body.student_id && !mongoose.Types.ObjectId.isValid(body.student_id)) {
      return NextResponse.json(
        { error: 'Invalid student ID' },
        { status: 400 }
      );
    }

    // Validate instructor ID if provided
    if (body.instructor_id && !mongoose.Types.ObjectId.isValid(body.instructor_id)) {
      return NextResponse.json(
        { error: 'Invalid instructor ID' },
        { status: 400 }
      );
    }

    // Validate plane ID if provided
    if (body.plane_id && !mongoose.Types.ObjectId.isValid(body.plane_id)) {
      return NextResponse.json(
        { error: 'Invalid plane ID' },
        { status: 400 }
      );
    }

    // Validate date range if provided
    if (body.start_time || body.end_time) {
      const startTime = body.start_time ? new Date(body.start_time) : schedule.start_time;
      const endTime = body.end_time ? new Date(body.end_time) : schedule.end_time;

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format for start_time or end_time' },
          { status: 400 }
        );
      }

      if (startTime >= endTime) {
        return NextResponse.json(
          { error: 'End time must be after start time' },
          { status: 400 }
        );
      }
    }

    // Check for scheduling conflicts if time is being updated
    if (body.start_time || body.end_time) {
      const startTime = body.start_time ? new Date(body.start_time) : schedule.start_time;
      const endTime = body.end_time ? new Date(body.end_time) : schedule.end_time;
      
      const conflictQuery: any = {
        school_id: params.schoolId,
        _id: { $ne: params.scheduleId }, // Exclude current schedule
        status: { $nin: ['canceled', 'completed'] },
        $or: [
          // Check if the updated schedule overlaps with existing schedules
          {
            start_time: { $lt: endTime },
            end_time: { $gt: startTime }
          }
        ]
      };

      // Add student conflict check
      const studentId = body.student_id || schedule.student_id;
      if (studentId) {
        const studentConflictQuery = { ...conflictQuery, student_id: studentId };
        const studentConflict = await (Schedule.findOne(studentConflictQuery) as any).exec();
        if (studentConflict) {
          return NextResponse.json(
            { error: 'Student already has a scheduled flight during this time' },
            { status: 400 }
          );
        }
      }

      // Add instructor conflict check if instructor is provided
      const instructorId = body.instructor_id || schedule.instructor_id;
      if (instructorId) {
        const instructorConflictQuery = { ...conflictQuery, instructor_id: instructorId };
        const instructorConflict = await (Schedule.findOne(instructorConflictQuery) as any).exec();
        if (instructorConflict) {
          return NextResponse.json(
            { error: 'Instructor already has a scheduled flight during this time' },
            { status: 400 }
          );
        }
      }

      // Add plane conflict check if plane is provided
      const planeId = body.plane_id || schedule.plane_id;
      if (planeId) {
        const planeConflictQuery = { ...conflictQuery, plane_id: planeId };
        const planeConflict = await (Schedule.findOne(planeConflictQuery) as any).exec();
        if (planeConflict) {
          return NextResponse.json(
            { error: 'Plane already has a scheduled flight during this time' },
            { status: 400 }
          );
        }
      }
    }

    // Update the schedule
    const updatedSchedule = await (Schedule.findByIdAndUpdate(
      params.scheduleId,
      {
        ...body,
        last_updated_by: auth.userId
      },
      { new: true, runValidators: true }
    )
      .populate('student_id', 'first_name last_name')
      .populate('instructor_id', 'first_name last_name')
      .populate('plane_id', 'tail_number model')
      .populate('created_by', 'first_name last_name')
      .populate('last_updated_by', 'first_name last_name') as any).exec();
    
    return NextResponse.json({
      message: 'Schedule updated successfully',
      schedule: updatedSchedule
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    
    // Check if it's a validation error
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/schedules/[scheduleId] - Delete a specific schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; scheduleId: string } }
) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get user from token
    const auth = authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || 
        !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or schedule ID' },
        { status: 400 }
      );
    }

    // If not a system admin, check school access
    if (!isSystemAdmin) {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck) {
        return schoolAccessCheck;
      }
    }

    // Find and delete the schedule
    const schedule = await (Schedule.findOneAndDelete({
      _id: params.scheduleId,
      school_id: params.schoolId
    }) as any).exec();
    
    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 