import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FlightLog from '@/models/FlightLog';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import mongoose from 'mongoose';

// Define the IFlightLog interface
interface IFlightLog {
  _id: mongoose.Types.ObjectId;
  school_id: mongoose.Types.ObjectId;
  student_id: mongoose.Types.ObjectId;
  instructor_id: mongoose.Types.ObjectId;
  plane_id: mongoose.Types.ObjectId;
  date: Date;
  start_time: string;
  end_time: string;
  duration: number;
  status: string;
  type: string;
  notes?: string;
  [key: string]: any;
}

// Connect to MongoDB
connectDB();

// GET /api/schools/[schoolId]/flight-logs
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  try {
    // Validate API key and authenticate user
    const apiKeyResult = await validateApiKey(request);
    if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }

    const authResult = authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.message }, { status: 401 });
    }

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID' },
        { status: 400 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const studentId = searchParams.get('student_id');
    const instructorId = searchParams.get('instructor_id');
    const planeId = searchParams.get('plane_id');
    const status = searchParams.get('status');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const type = searchParams.get('type');

    // Build query
    const query: any = { school_id: params.schoolId };

    if (studentId) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return NextResponse.json(
          { error: 'Invalid student ID' },
          { status: 400 }
        );
      }
      query.student_id = studentId;
    }

    if (instructorId) {
      if (!mongoose.Types.ObjectId.isValid(instructorId)) {
        return NextResponse.json(
          { error: 'Invalid instructor ID' },
          { status: 400 }
        );
      }
      query.instructor_id = instructorId;
    }

    if (planeId) {
      if (!mongoose.Types.ObjectId.isValid(planeId)) {
        return NextResponse.json(
          { error: 'Invalid plane ID' },
          { status: 400 }
        );
      }
      query.plane_id = planeId;
    }

    if (status) {
      query.status = status;
    }

    if (type) {
      query.type = type;
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.date = { $lte: new Date(endDate) };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // @ts-ignore - Mongoose type issue
    const [flightLogs, total] = await Promise.all([
      // @ts-ignore - Mongoose type issue
      FlightLog.find(query)
        .sort({ date: -1, start_time: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      // @ts-ignore - Mongoose type issue
      FlightLog.countDocuments(query)
    ]);

    return NextResponse.json({
      flightLogs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching flight logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flight logs' },
      { status: 500 }
    );
  }
}

// POST /api/schools/[schoolId]/flight-logs
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  try {
    // Validate API key and authenticate user
    const apiKeyResult = await validateApiKey(request);
    if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }

    const authResult = authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.message }, { status: 401 });
    }

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['date', 'start_time', 'end_time', 'plane_id', 'student_id', 'instructor_id', 'type'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Validate date format
    const flightDate = new Date(body.date);
    if (isNaN(flightDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Validate ObjectId fields
    const objectIdFields = ['plane_id', 'student_id', 'instructor_id'];
    for (const field of objectIdFields) {
      if (!mongoose.Types.ObjectId.isValid(body[field])) {
        return NextResponse.json(
          { error: `Invalid ${field}` },
          { status: 400 }
        );
      }
    }

    // Calculate duration
    const startTime = new Date(`1970-01-01T${body.start_time}`);
    const endTime = new Date(`1970-01-01T${body.end_time}`);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    if (durationHours <= 0) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    // Create flight log
    // @ts-ignore - Mongoose type issue
    const flightLog = new FlightLog({
      ...body,
      school_id: params.schoolId,
      duration: durationHours
    });

    // @ts-ignore - Mongoose type issue
    await flightLog.save();

    return NextResponse.json(flightLog, { status: 201 });
  } catch (error) {
    console.error('Error creating flight log:', error);
    return NextResponse.json(
      { error: 'Failed to create flight log' },
      { status: 500 }
    );
  }
} 