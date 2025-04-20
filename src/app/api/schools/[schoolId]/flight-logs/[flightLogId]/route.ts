import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import FlightLog from '@/models/FlightLog';
import ScheduleModel from '@/models/ScheduleModel';
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

// GET /api/schools/[schoolId]/flight-logs/[flightLogId]
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string; flightLogId: string } }
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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || 
        !mongoose.Types.ObjectId.isValid(params.flightLogId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or flight log ID' },
        { status: 400 }
      );
    }

    // @ts-ignore - Mongoose type issue
    const flightLog = await FlightLog.findOne({
      _id: params.flightLogId,
      school_id: params.schoolId
    }).lean();

    if (!flightLog) {
      return NextResponse.json(
        { error: 'Flight log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(flightLog);
  } catch (error) {
    console.error('Error fetching flight log:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flight log' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId]/flight-logs/[flightLogId]
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string; flightLogId: string } }
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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || 
        !mongoose.Types.ObjectId.isValid(params.flightLogId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or flight log ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate date format if provided
    if (body.date) {
      const flightDate = new Date(body.date);
      if (isNaN(flightDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format' },
          { status: 400 }
        );
      }
    }

    // Validate duration if provided
    if (body.duration !== undefined) {
      if (typeof body.duration !== 'number' || body.duration <= 0) {
        return NextResponse.json(
          { error: 'Duration must be a positive number' },
          { status: 400 }
        );
      }
    }

    // Handle status value to match the enum values in the model
    if (body.status) {
      // Convert status to proper case format
      if (body.status.toLowerCase() === 'completed') {
        body.status = 'Completed';
      } else if (body.status.toLowerCase() === 'scheduled') {
        body.status = 'Scheduled';
      } else if (body.status.toLowerCase() === 'in-flight' || body.status.toLowerCase() === 'inflight') {
        body.status = 'In-Flight';
      }
    }

    // First, get the current flight log to compare changes
    // @ts-ignore - Mongoose type issue
    const currentFlightLog = await FlightLog.findById(params.flightLogId).lean();
    if (!currentFlightLog) {
      return NextResponse.json(
        { error: 'Flight log not found' },
        { status: 404 }
      );
    }

    // Update the flight log
    // @ts-ignore - Mongoose type issue
    const updatedFlightLog = await FlightLog.findByIdAndUpdate(
      params.flightLogId,
      body,
      { new: true }
    ).lean();

    if (!updatedFlightLog) {
      return NextResponse.json(
        { error: 'Flight log not found' },
        { status: 404 }
      );
    }

    // Find the associated schedule
    // @ts-ignore - Mongoose type issue
    const schedule = await ScheduleModel.findOne({
      school_id: params.schoolId,
      student_id: updatedFlightLog.student_id,
      instructor_id: updatedFlightLog.instructor_id,
      date: updatedFlightLog.date,
      start_time: updatedFlightLog.start_time
    }).lean();

    // If a schedule is found, update it with relevant information
    if (schedule) {
      const scheduleUpdates: any = {};
      
      // Map flight log status to schedule status
      if (updatedFlightLog.status === 'Completed') {
        scheduleUpdates.status = 'completed';
      } else if (updatedFlightLog.status === 'In-Flight') {
        scheduleUpdates.status = 'in-progress';
      } else if (updatedFlightLog.status === 'Scheduled') {
        scheduleUpdates.status = 'scheduled';
      }
      
      // Update other relevant fields
      if (body.start_time && body.start_time !== currentFlightLog.start_time) {
        scheduleUpdates.start_time = body.start_time;
      }
      
      if (body.plane_id && body.plane_id.toString() !== currentFlightLog.plane_id.toString()) {
        scheduleUpdates.plane_id = body.plane_id;
      }
      
      if (body.type && body.type !== currentFlightLog.type) {
        scheduleUpdates.flight_type = body.type;
      }
      
      // If duration is updated, recalculate end_time
      if (body.duration && body.duration !== currentFlightLog.duration) {
        // Parse the start time into hours and minutes
        const [startHours, startMinutes] = updatedFlightLog.start_time.split(':').map(Number);
        
        // Calculate total minutes from start time
        const startTotalMinutes = startHours * 60 + startMinutes;
        
        // Calculate duration in minutes (convert hours to minutes)
        const durationMinutes = body.duration * 60;
        
        // Calculate end time in total minutes
        const endTotalMinutes = startTotalMinutes + durationMinutes;
        
        // Convert back to hours and minutes
        const endHours = Math.floor(endTotalMinutes / 60);
        const endMinutes = endTotalMinutes % 60;
        
        // Format end time as HH:mm
        const endTimeStr = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
        
        scheduleUpdates.end_time = endTimeStr;
      }
      
      // Only update if there are changes
      if (Object.keys(scheduleUpdates).length > 0) {
        // @ts-ignore - Mongoose type issue
        await ScheduleModel.findByIdAndUpdate(
          schedule._id,
          { $set: scheduleUpdates },
          { new: true, runValidators: true }
        );
      }
    }

    return NextResponse.json(updatedFlightLog);
  } catch (error) {
    console.error('Error updating flight log:', error);
    return NextResponse.json(
      { error: 'Failed to update flight log' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/flight-logs/[flightLogId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; flightLogId: string } }
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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || 
        !mongoose.Types.ObjectId.isValid(params.flightLogId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or flight log ID' },
        { status: 400 }
      );
    }

    // @ts-ignore - Mongoose type issue
    const flightLog = await FlightLog.findOneAndDelete({
      _id: params.flightLogId,
      school_id: params.schoolId
    });

    if (!flightLog) {
      return NextResponse.json(
        { error: 'Flight log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Flight log deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting flight log:', error);
    return NextResponse.json(
      { error: 'Failed to delete flight log' },
      { status: 500 }
    );
  }
} 