import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import Track from '@/models/Track';

// POST handler to stop tracking a specific track
export async function POST(
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

    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Validate trackId format
    if (!mongoose.Types.ObjectId.isValid(params.trackId)) {
      return NextResponse.json(
        { error: 'Invalid track ID format' },
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

    // Check if the track is already completed or cancelled
    if (track.status === 'Completed' || track.status === 'Cancelled') {
      return NextResponse.json({
        message: `Track is already ${track.status.toLowerCase()}`,
        track
      });
    }

    // Parse request body for status
    const body = await request.json();
    const status = body.status || 'Completed';

    // Update the track status
    track.status = status;
    track.notes = track.notes ? 
      `${track.notes}\nTracking stopped at ${new Date().toISOString()} with status: ${status}` : 
      `Tracking stopped at ${new Date().toISOString()} with status: ${status}`;
    
    // Save the updated track
    await track.save();

    return NextResponse.json({
      message: `Tracking stopped successfully with status: ${status}`,
      track
    });
  } catch (error) {
    console.error('Error stopping tracking:', error);
    return NextResponse.json(
      { error: 'Failed to stop tracking' },
      { status: 500 }
    );
  }
} 