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

// GET /api/schools/[schoolId]/flight-logs/today
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
    const studentId = searchParams.get('student_id');
    const instructorId = searchParams.get('instructor_id');
    const planeId = searchParams.get('plane_id');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    // Get today's date (start and end of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Build query
    const query: any = {
      school_id: params.schoolId,
      date: {
        $gte: today,
        $lt: tomorrow
      }
    };

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

    // Get all flight logs for today
    // @ts-ignore - Mongoose type issue
    const flightLogs = await FlightLog.find(query)
      .sort({ start_time: 1 }) // Sort by start time
      .lean();
      
    return NextResponse.json(flightLogs);
  } catch (error) {
    console.error('Error fetching today\'s flight logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch today\'s flight logs' },
      { status: 500 }
    );
  }
} 