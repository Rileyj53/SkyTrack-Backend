import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import Track from '@/models/Track';

// GET handler to retrieve all tracks with optional filtering
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get query parameters for filtering
    const url = new URL(request.url);
    const tailNumber = url.searchParams.get('tail_number');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const planeId = url.searchParams.get('plane_id');
    const schoolId = url.searchParams.get('school_id');
    const instructorId = url.searchParams.get('instructor_id');
    const studentId = url.searchParams.get('student_id');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const page = parseInt(url.searchParams.get('page') || '1');

    // Build filter object
    const filter: any = {};
    
    if (tailNumber) filter.tail_number = tailNumber;
    if (planeId) filter.plane_id = new mongoose.Types.ObjectId(planeId);
    if (schoolId) filter.school_id = new mongoose.Types.ObjectId(schoolId);
    if (instructorId) filter.instructor_id = new mongoose.Types.ObjectId(instructorId);
    if (studentId) filter.student_id = new mongoose.Types.ObjectId(studentId);
    
    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Find tracks with pagination
    const tracks = await (Track as any).find(filter)
      .sort({ date: -1, start_time: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Count total documents for pagination
    const total = await Track.countDocuments(filter);

    return NextResponse.json({
      tracks,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tracks' },
      { status: 500 }
    );
  }
}

// POST handler to create a new track
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.tail_number) {
      return NextResponse.json(
        { error: 'Tail number is required' },
        { status: 400 }
      );
    }

    // Check if track with the same fa_flight_id already exists (if provided)
    if (body.fa_flight_id) {
      const existingTrack = await (Track as any).findOne({
        fa_flight_id: body.fa_flight_id
      }).exec();

      if (existingTrack) {
        return NextResponse.json(
          { error: 'Track with this Flight Aware ID already exists' },
          { status: 409 }
        );
      }
    }

    // Process tracking data to ensure field names match the schema
    let tracking = [];
    if (body.tracking && Array.isArray(body.tracking)) {
      tracking = body.tracking.map(point => ({
        altitude: point.altitude,
        ground_speed: point.ground_speed,
        heading: point.heading,
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: new Date(point.timestamp),
        vertical_speed: point.vertical_speed,
        fuel_remaining: point.fuel_remaining,
        engine_rpm: point.engine_rpm,
        outside_air_temp: point.outside_air_temp,
        wind_speed: point.wind_speed,
        wind_direction: point.wind_direction
      }));
    }

    // Create new track
    const track = new Track({
      fa_flight_id: body.fa_flight_id,
      tail_number: body.tail_number,
      date: body.date ? new Date(body.date) : undefined,
      start_time: body.start_time,
      scheduled_off: body.scheduled_off,
      estimated_off: body.estimated_off,
      actual_off: body.actual_off,
      scheduled_on: body.scheduled_on,
      estimated_on: body.estimated_on,
      actual_on: body.actual_on,
      status: body.status,
      origin: body.origin,
      destination: body.destination,
      tracking: tracking,
      flight_type: body.flight_type,
      flight_plan: body.flight_plan,
      route: body.route,
      distance: body.distance,
      duration: body.duration,
      instructor_id: body.instructor_id ? new mongoose.Types.ObjectId(body.instructor_id) : undefined,
      student_id: body.student_id ? new mongoose.Types.ObjectId(body.student_id) : undefined,
      plane_id: body.plane_id ? new mongoose.Types.ObjectId(body.plane_id) : undefined,
      school_id: body.school_id ? new mongoose.Types.ObjectId(body.school_id) : undefined,
      notes: body.notes,
      weather_conditions: body.weather_conditions,
      flight_events: body.flight_events ? body.flight_events.map(event => ({
        ...event,
        timestamp: new Date(event.timestamp)
      })) : undefined
    });

    // Save the track
    await track.save();

    // Return the created track
    return NextResponse.json({
      message: 'Track created successfully',
      track,
      status: 'success'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating track:', error);
    return NextResponse.json(
      { error: 'Failed to create track' },
      { status: 500 }
    );
  }
} 