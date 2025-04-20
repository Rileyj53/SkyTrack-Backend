import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import Track from '@/models/Track';

// GET handler to retrieve a specific track
export async function GET(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
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

    // Validate track ID
    if (!mongoose.Types.ObjectId.isValid(params.trackId)) {
      return NextResponse.json(
        { error: 'Invalid track ID' },
        { status: 400 }
      );
    }

    // Find the track
    const track = await (Track as any).findById(params.trackId);

    if (!track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(track);
  } catch (error) {
    console.error('Error fetching track:', error);
    return NextResponse.json(
      { error: 'Failed to fetch track' },
      { status: 500 }
    );
  }
}

// PUT handler to update a track
export async function PUT(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
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

    // Validate track ID
    if (!mongoose.Types.ObjectId.isValid(params.trackId)) {
      return NextResponse.json(
        { error: 'Invalid track ID' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Find the track
    const track = await (Track as any).findById(params.trackId);

    if (!track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    // If fa_flight_id is being updated, check if it's already in use
    if (body.fa_flight_id && body.fa_flight_id !== track.fa_flight_id) {
      const existingTrack = await (Track as any).findOne({
        fa_flight_id: body.fa_flight_id,
        _id: { $ne: params.trackId }
      }).exec();

      if (existingTrack) {
        return NextResponse.json(
          { error: 'Flight Aware ID is already in use' },
          { status: 409 }
        );
      }
    }

    // Update track fields
    if (body.fa_flight_id) track.fa_flight_id = body.fa_flight_id;
    if (body.tail_number) track.tail_number = body.tail_number;
    if (body.date) track.date = new Date(body.date);
    if (body.start_time) track.start_time = body.start_time;
    if (body.scheduled_off) track.scheduled_off = body.scheduled_off;
    if (body.estimated_off) track.estimated_off = body.estimated_off;
    if (body.actual_off) track.actual_off = body.actual_off;
    if (body.scheduled_on) track.scheduled_on = body.scheduled_on;
    if (body.estimated_on) track.estimated_on = body.estimated_on;
    if (body.actual_on) track.actual_on = body.actual_on;
    if (body.status) track.status = body.status;
    if (body.origin) track.origin = body.origin;
    if (body.destination) track.destination = body.destination;
    if (body.tracking) track.tracking = body.tracking;
    if (body.flight_type) track.flight_type = body.flight_type;
    if (body.flight_plan) track.flight_plan = body.flight_plan;
    if (body.route) track.route = body.route;
    if (body.distance) track.distance = body.distance;
    if (body.duration) track.duration = body.duration;
    if (body.instructor_id) track.instructor_id = new mongoose.Types.ObjectId(body.instructor_id);
    if (body.student_id) track.student_id = new mongoose.Types.ObjectId(body.student_id);
    if (body.plane_id) track.plane_id = new mongoose.Types.ObjectId(body.plane_id);
    if (body.school_id) track.school_id = new mongoose.Types.ObjectId(body.school_id);
    if (body.notes) track.notes = body.notes;
    if (body.weather_conditions) track.weather_conditions = body.weather_conditions;
    if (body.flight_events) track.flight_events = body.flight_events;

    // Save the updated track
    await track.save();

    // Return the updated track
    return NextResponse.json({
      message: 'Track updated successfully',
      track,
      status: 'success'
    });
  } catch (error) {
    console.error('Error updating track:', error);
    return NextResponse.json(
      { error: 'Failed to update track' },
      { status: 500 }
    );
  }
}

// DELETE handler to delete a track
export async function DELETE(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
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

    // Validate track ID
    if (!mongoose.Types.ObjectId.isValid(params.trackId)) {
      return NextResponse.json(
        { error: 'Invalid track ID' },
        { status: 400 }
      );
    }

    // Find and delete the track
    const track = await (Track as any).findByIdAndDelete(params.trackId).exec();

    if (!track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Track deleted successfully',
      status: 'success'
    });
  } catch (error) {
    console.error('Error deleting track:', error);
    return NextResponse.json(
      { error: 'Failed to delete track' },
      { status: 500 }
    );
  }
} 