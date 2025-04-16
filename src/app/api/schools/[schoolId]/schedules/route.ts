import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { checkSchoolAccess } from '@/middleware/schoolAccess';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import { User } from '@/models/User';
import Schedule from '@/models/Schedule';

// Connect to MongoDB
connectDB();

// GET /api/schools/[schoolId]/schedules - List all schedules for a school
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
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

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID' },
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

    // Get query parameters for filtering
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const studentId = url.searchParams.get('studentId');
    const instructorId = url.searchParams.get('instructorId');
    const planeId = url.searchParams.get('planeId');
    const status = url.searchParams.get('status');
    const flightType = url.searchParams.get('flightType');

    // Build query
    const query: any = { school_id: params.schoolId };

    if (startDate) {
      query.start_time = { $gte: new Date(startDate) };
    }

    if (endDate) {
      query.end_time = { $lte: new Date(endDate) };
    }

    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
      query.student_id = studentId;
    }

    if (instructorId && mongoose.Types.ObjectId.isValid(instructorId)) {
      query.instructor_id = instructorId;
    }

    if (planeId && mongoose.Types.ObjectId.isValid(planeId)) {
      query.plane_id = planeId;
    }

    if (status) {
      query.status = status;
    }

    if (flightType) {
      query.flight_type = flightType;
    }

    // Find all schedules for this school with filters
    const schedules = await (Schedule.find(query)
      .populate('student_id', 'first_name last_name')
      .populate('instructor_id', 'first_name last_name')
      .populate('plane_id', 'tail_number model')
      .sort({ start_time: 1 }) as any).exec();
    
    return NextResponse.json({
      schedules
    });
  } catch (error) {
    console.error('Error listing schedules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/schools/[schoolId]/schedules - Create a new schedule for a school
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
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

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID' },
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
    
    // Validate required fields
    if (!body.student_id || !body.start_time || !body.end_time) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, start_time, end_time' },
        { status: 400 }
      );
    }

    // Validate student ID
    if (!mongoose.Types.ObjectId.isValid(body.student_id)) {
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

    // Validate date range
    const startTime = new Date(body.start_time);
    const endTime = new Date(body.end_time);

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

    // Check for scheduling conflicts
    const conflictQuery: any = {
      school_id: params.schoolId,
      status: { $nin: ['canceled', 'completed'] },
      $or: [
        // Check if the new schedule overlaps with existing schedules
        {
          start_time: { $lt: endTime },
          end_time: { $gt: startTime }
        }
      ]
    };

    // Add student conflict check
    if (body.student_id) {
      const studentConflictQuery = { ...conflictQuery, student_id: body.student_id };
      const studentConflict = await (Schedule.findOne(studentConflictQuery) as any).exec();
      if (studentConflict) {
        return NextResponse.json(
          { error: 'Student already has a scheduled flight during this time' },
          { status: 400 }
        );
      }
    }

    // Add instructor conflict check if instructor is provided
    if (body.instructor_id) {
      const instructorConflictQuery = { ...conflictQuery, instructor_id: body.instructor_id };
      const instructorConflict = await (Schedule.findOne(instructorConflictQuery) as any).exec();
      if (instructorConflict) {
        return NextResponse.json(
          { error: 'Instructor already has a scheduled flight during this time' },
          { status: 400 }
        );
      }
    }

    // Add plane conflict check if plane is provided
    if (body.plane_id) {
      const planeConflictQuery = { ...conflictQuery, plane_id: body.plane_id };
      const planeConflict = await (Schedule.findOne(planeConflictQuery) as any).exec();
      if (planeConflict) {
        return NextResponse.json(
          { error: 'Plane already has a scheduled flight during this time' },
          { status: 400 }
        );
      }
    }

    // Create new schedule
    const schedule = await (Schedule.create({
      ...body,
      school_id: params.schoolId,
      created_by: auth.userId
    }) as any);
    
    return NextResponse.json({
      message: 'Schedule created successfully',
      schedule
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating schedule:', error);
    
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