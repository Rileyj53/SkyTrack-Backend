import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import { checkSchoolAccess } from '@/middleware/schoolAccess';
import { verifyToken } from '@/lib/jwt';
import { Schedule, Pilot, User } from '@/models';
import { connectDB } from '@/lib/db';
import ScheduleModel from '@/models/Schedule';

// Connect to MongoDB
connectDB();

// GET /api/schools/[schoolId]/schedules/[scheduleId] - Get a specific schedule
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string; scheduleId: string } }
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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Find the schedule
    const schedule = await (ScheduleModel as any).findOne({
      _id: params.scheduleId,
      school_id: params.schoolId
    }).lean();

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/schedules/[scheduleId]:', error);
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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json();

    // Find the schedule
    const schedule = await (ScheduleModel as any).findOne({
      _id: params.scheduleId,
      school_id: params.schoolId
    });

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Update schedule
    Object.assign(schedule, body);
    await schedule.save();

    return NextResponse.json({
      message: 'Schedule updated successfully',
      schedule
    });
  } catch (error) {
    console.error('Error in PUT /api/schools/[schoolId]/schedules/[scheduleId]:', error);
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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Find and delete schedule
    const schedule = await (ScheduleModel as any).findOneAndDelete({
      _id: params.scheduleId,
      school_id: params.schoolId
    });

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
    console.error('Error in DELETE /api/schools/[schoolId]/schedules/[scheduleId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 