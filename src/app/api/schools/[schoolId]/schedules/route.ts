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

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID format' },
        { status: 400 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const studentId = searchParams.get('studentId');
    const instructorId = searchParams.get('instructorId');
    const planeId = searchParams.get('planeId');
    const status = searchParams.get('status');

    // Build query
    const query: any = { school_id: params.schoolId };

    if (startDate && endDate) {
      query.start_time = { $gte: new Date(startDate) };
      query.end_time = { $lte: new Date(endDate) };
    }

    if (studentId) query.student_id = studentId;
    if (instructorId) query.instructor_id = instructorId;
    if (planeId) query.plane_id = planeId;
    if (status) query.status = status;

    // Find all schedules for this school with filters
    const schedules = await (Schedule as any).find(query)
      .populate('student_id', 'first_name last_name')
      .populate('instructor_id', 'first_name last_name')
      .populate('plane_id', 'tail_number model')
      .lean();

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/schedules:', error);
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
    const requiredFields = [
      'student_id',
      'instructor_id',
      'plane_id',
      'start_time',
      'end_time',
      'flight_type'
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(body.student_id) ||
        !mongoose.Types.ObjectId.isValid(body.instructor_id) ||
        !mongoose.Types.ObjectId.isValid(body.plane_id)) {
      return NextResponse.json(
        { error: 'Invalid ID format for student, instructor, or plane' },
        { status: 400 }
      );
    }

    // Check for scheduling conflicts
    const conflictQuery = {
      school_id: params.schoolId,
      status: { $nin: ['canceled', 'completed'] },
      $or: [
        {
          start_time: { $lt: new Date(body.end_time) },
          end_time: { $gt: new Date(body.start_time) }
        }
      ]
    };

    // Check student conflicts
    const studentConflict = await (Schedule as any).findOne({
      ...conflictQuery,
      student_id: body.student_id
    }).lean();

    if (studentConflict) {
      return NextResponse.json(
        { error: 'Student already has a scheduled flight during this time' },
        { status: 400 }
      );
    }

    // Check instructor conflicts
    const instructorConflict = await (Schedule as any).findOne({
      ...conflictQuery,
      instructor_id: body.instructor_id
    }).lean();

    if (instructorConflict) {
      return NextResponse.json(
        { error: 'Instructor already has a scheduled flight during this time' },
        { status: 400 }
      );
    }

    // Check plane conflicts
    const planeConflict = await (Schedule as any).findOne({
      ...conflictQuery,
      plane_id: body.plane_id
    }).lean();

    if (planeConflict) {
      return NextResponse.json(
        { error: 'Plane already has a scheduled flight during this time' },
        { status: 400 }
      );
    }

    // Create new schedule
    const schedule = new Schedule({
      ...body,
      school_id: params.schoolId,
      created_by: authResult.userId,
      last_updated_by: authResult.userId
    });

    await schedule.save();

    return NextResponse.json(
      { message: 'Schedule created successfully', schedule },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/schools/[schoolId]/schedules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 