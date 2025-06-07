import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import FlightSchedule from '@/models/FlightSchedule';
import { School } from '@/models/School';
import Student from '@/models/Student';
import Instructor from '@/models/Instructor';
import Plane from '@/models/Plane';
import { User } from '@/models/User';
import mongoose from 'mongoose';

// GET /api/schools/[schoolId]/flight_schedule - List all flight schedules for a school
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
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

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID format' },
        { status: 400 }
      );
    }

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // Check if user has access to this school (implement based on your existing logic)
    if (!isSystemAdmin) {
      // Add school access check logic here if needed
    }

    // Parse query parameters for filtering
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const status = url.searchParams.get('status');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const planeId = url.searchParams.get('plane_id');
    const instructorId = url.searchParams.get('instructor_id');
    const studentId = url.searchParams.get('student_id');

    // Build filter object
    const filter: any = { school_id: params.schoolId };
    
    if (status) filter.status = status;
    if (planeId && mongoose.Types.ObjectId.isValid(planeId)) filter.plane_id = planeId;
    if (instructorId && mongoose.Types.ObjectId.isValid(instructorId)) filter.instructor_id = instructorId;
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) filter.student_id = studentId;
    
    if (startDate || endDate) {
      filter.scheduled_start_time = {};
      if (startDate) {
        // Expand start date by 24 hours earlier to account for timezone differences
        // This ensures we catch flights that are on the same local date but different UTC date
        const startOfDay = new Date(startDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        startOfDay.setUTCDate(startOfDay.getUTCDate() - 1); // Go back 1 day
        filter.scheduled_start_time.$gte = startOfDay;
      }
      if (endDate) {
        // Expand end date by 24 hours later to account for timezone differences
        const endOfDay = new Date(endDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        endOfDay.setUTCDate(endOfDay.getUTCDate() + 1); // Go forward 1 day
        filter.scheduled_start_time.$lte = endOfDay;
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get flight schedules with populated data
    const schedules = await (FlightSchedule as any)
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
      .sort({ scheduled_start_time: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await FlightSchedule.countDocuments(filter);

    return NextResponse.json({
      schedules,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/flight_schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/schools/[schoolId]/flight_schedule - Create a new flight schedule
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
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

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID format' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['plane_id', 'student_id', 'scheduled_start_time', 'scheduled_end_time', 'flight_type'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Validate ObjectId fields (instructor_id is optional)
    const objectIdFields = ['plane_id', 'student_id'];
    for (const field of objectIdFields) {
      if (!mongoose.Types.ObjectId.isValid(body[field])) {
        return NextResponse.json(
          { error: `Invalid ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate instructor_id if provided
    if (body.instructor_id && !mongoose.Types.ObjectId.isValid(body.instructor_id)) {
      return NextResponse.json(
        { error: 'Invalid instructor_id' },
        { status: 400 }
      );
    }

    // Validate date fields
    const scheduledStartTime = new Date(body.scheduled_start_time);
    const scheduledEndTime = new Date(body.scheduled_end_time);
    
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
    if (actualStartTime && actualEndTime && actualStartTime >= actualEndTime) {
      return NextResponse.json(
        { error: 'Actual end time must be after actual start time' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Schedule conflict detected. The plane, instructor, or student is already scheduled during this time.' },
        { status: 409 }
      );
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

    return NextResponse.json({
      message: 'Flight schedule created successfully',
      schedule: populatedSchedule
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/schools/[schoolId]/flight_schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 