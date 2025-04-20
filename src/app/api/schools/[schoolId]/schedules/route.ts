import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { checkSchoolAccess } from '@/middleware/schoolAccess';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import { User, Student, Instructor } from '@/models';
import ScheduleModel from '@/models/ScheduleModel';
import FlightLog from '@/models/FlightLog';
import Plane from '@/models/Plane';

// Connect to MongoDB
connectDB();

// Define interfaces for type safety
interface ISchedule extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  school_id: mongoose.Types.ObjectId;
  student_id: mongoose.Types.ObjectId;
  instructor_id: mongoose.Types.ObjectId;
  plane_id: mongoose.Types.ObjectId;
  date: Date;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  notes?: string;
  [key: string]: any;
}

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
    const type = searchParams.get('type');

    // Get schedules with pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Find schedules with pagination
    const query = {
      school_id: new mongoose.Types.ObjectId(params.schoolId),
      ...(studentId && { student_id: new mongoose.Types.ObjectId(studentId) }),
      ...(instructorId && { instructor_id: new mongoose.Types.ObjectId(instructorId) }),
      ...(planeId && { plane_id: new mongoose.Types.ObjectId(planeId) }),
      ...(type && { type }),
      ...(status && { status }),
      ...(startDate && { date: { $gte: new Date(startDate) } }),
      ...(endDate && { date: { $lte: new Date(endDate) } })
    };

    const [schedules, total] = await Promise.all([
      (ScheduleModel as any).find(query)
        .sort({ date: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      (ScheduleModel as any).countDocuments(query)
    ]);

    return NextResponse.json({
      schedules,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
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

    // Extract date from start_time if not provided
    if (!body.date && body.start_time) {
      const startDate = new Date(body.start_time);
      if (!isNaN(startDate.getTime())) {
        body.date = startDate.toISOString().split('T')[0]; // Extract just the date part
      }
    } else if (body.date) {
      // Convert string date to Date object if it's a string
      if (typeof body.date === 'string') {
        body.date = new Date(body.date);
      }
    }

    // Parse start_time and end_time if they're in ISO format
    if (body.start_time && body.start_time.includes('T')) {
      const startDate = new Date(body.start_time);
      if (!isNaN(startDate.getTime())) {
        body.start_time = startDate.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'UTC'
        });
      }
    }

    if (body.end_time && body.end_time.includes('T')) {
      const endDate = new Date(body.end_time);
      if (!isNaN(endDate.getTime())) {
        body.end_time = endDate.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'UTC'
        });
      }
    }

    // Map flight_type to type if needed
    if (body.flight_type && !body.type) {
      body.type = body.flight_type;
    }

    // Validate required fields
    const requiredFields = [
      'date',
      'start_time',
      'end_time',
      'plane_id',
      'student_id',
      'instructor_id',
      'type'
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Validate ObjectId fields
    const objectIdFields = ['student_id', 'instructor_id', 'plane_id'];
    for (const field of objectIdFields) {
      if (!mongoose.Types.ObjectId.isValid(body[field])) {
        return NextResponse.json(
          { error: `Invalid ${field}` },
          { status: 400 }
        );
      }
      body[field] = new mongoose.Types.ObjectId(body[field]);
    }

    // Validate date format
    const scheduleDate = new Date(body.date);
    if (isNaN(scheduleDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Check for scheduling conflicts
    const existingSchedules = await (ScheduleModel as any).find({
      school_id: new mongoose.Types.ObjectId(params.schoolId),
      date: body.date, // Only check schedules on the same date
      $or: [
        { plane_id: body.plane_id },
        { instructor_id: body.instructor_id },
        { student_id: body.student_id }
      ]
    }).lean();

    console.log('Existing schedules:', existingSchedules);
    console.log('New schedule times:', { start: body.start_time, end: body.end_time });

    // Check for time conflicts manually
    const hasConflict = existingSchedules.some(schedule => {
      // Convert times to minutes for easier comparison
      const [scheduleStartHours, scheduleStartMinutes] = schedule.start_time.split(':').map(Number);
      const [scheduleEndHours, scheduleEndMinutes] = schedule.end_time.split(':').map(Number);
      const [newStartHours, newStartMinutes] = body.start_time.split(':').map(Number);
      const [newEndHours, newEndMinutes] = body.end_time.split(':').map(Number);

      const scheduleStartTotal = scheduleStartHours * 60 + scheduleStartMinutes;
      const scheduleEndTotal = scheduleEndHours * 60 + scheduleEndMinutes;
      const newStartTotal = newStartHours * 60 + newStartMinutes;
      const newEndTotal = newEndHours * 60 + newEndMinutes;

      console.log('Comparing times:', {
        schedule: { start: scheduleStartTotal, end: scheduleEndTotal },
        new: { start: newStartTotal, end: newEndTotal }
      });

      // Check if the new time range overlaps with the existing schedule
      const isConflict = (newStartTotal < scheduleEndTotal && newEndTotal > scheduleStartTotal);
      console.log('Is conflict:', isConflict);
      return isConflict;
    });

    if (hasConflict) {
      return NextResponse.json(
        { error: 'Scheduling conflict detected' },
        { status: 409 }
      );
    }

    // Check if student and instructor exist
    const [student, instructor] = await Promise.all([
      (Student as any).findOne({ _id: body.student_id, school_id: params.schoolId }).select('first_name last_name user_id').lean(),
      (Instructor as any).findOne({ _id: body.instructor_id, school_id: params.schoolId }).select('first_name last_name user_id').lean(),
    ]);

    if (!student || !instructor) {
      return NextResponse.json(
        { error: 'Could not find student or instructor information' },
        { status: 400 }
      );
    }

    // Fetch user information for student and instructor
    const [studentUser, instructorUser] = await Promise.all([
      User.findById(student.user_id).select('first_name last_name').lean(),
      User.findById(instructor.user_id).select('first_name last_name').lean(),
    ]);

    if (!studentUser || !instructorUser) {
      return NextResponse.json(
        { error: 'Could not find user information for student or instructor' },
        { status: 400 }
      );
    }

    // Create new schedule
    const schedule = new ScheduleModel({
      ...body,
      school_id: params.schoolId,
      student_id: body.student_id,
      instructor_id: body.instructor_id,
      flight_type: body.type,
      status: body.status?.toLowerCase() || 'scheduled',
      created_by: authResult.userId
    });
    
    // Save the schedule to the database
    await schedule.save();

    // Fetch related information for flight log
    const plane = await (Plane as any).findById(body.plane_id).select('registration').lean();

    if (!plane) {
      return NextResponse.json(
        { error: 'Could not find plane information' },
        { status: 400 }
      );
    }

    // Calculate duration in hours
    const startTime = new Date(`${body.date.toISOString().split('T')[0]}T${body.start_time}`);
    const endTime = new Date(`${body.date.toISOString().split('T')[0]}T${body.end_time}`);
    
    // Ensure we have valid dates
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return NextResponse.json(
        { error: 'Invalid start_time or end_time format' },
        { status: 400 }
      );
    }
    
    // Calculate duration in hours
    const durationMs = endTime.getTime() - startTime.getTime();
    const duration = durationMs / (1000 * 60 * 60);
    
    // Ensure duration is a valid number
    if (isNaN(duration) || duration <= 0) {
      return NextResponse.json(
        { error: 'Invalid duration calculated from start_time and end_time' },
        { status: 400 }
      );
    }

    // Create flight log with proper user names
    const flightLog = await (FlightLog as any).create({
      school_id: new mongoose.Types.ObjectId(params.schoolId),
      date: body.date instanceof Date ? body.date.toISOString().split('T')[0] : body.date,
      start_time: body.start_time,
      plane_reg: plane.registration,
      plane_id: body.plane_id,
      student_name: `${studentUser.first_name} ${studentUser.last_name}`,
      student_id: body.student_id,
      instructor: `${instructorUser.first_name} ${instructorUser.last_name}`,
      instructor_id: body.instructor_id,
      duration,
      type: body.type,
      status: 'Scheduled'
    });

    // Fetch the created flight log to ensure all fields are included
    const createdFlightLog = await (FlightLog as any).findById(flightLog._id).lean();

    return NextResponse.json({
      schedule,
      flightLog: createdFlightLog
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json(
      { error: 'Failed to create schedule' },
      { status: 500 }
    );
  }
} 