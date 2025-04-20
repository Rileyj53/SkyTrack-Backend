import { NextRequest, NextResponse } from 'next/server';
import mongoose, { Model, Document } from 'mongoose';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import { checkSchoolAccess } from '@/middleware/schoolAccess';
import { verifyToken } from '@/lib/jwt';
import { User, Student, Instructor } from '@/models';
import { connectDB } from '@/lib/db';
import ScheduleModel from '@/models/ScheduleModel';
import FlightLog from '@/models/FlightLog';
import Plane from '@/models/Plane';

// Connect to MongoDB
connectDB();

// Define interfaces for type safety
interface ISchedule extends Document {
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

interface IFlightLog extends Document {
  _id: mongoose.Types.ObjectId;
  school_id: mongoose.Types.ObjectId;
  student_id: mongoose.Types.ObjectId;
  instructor_id: mongoose.Types.ObjectId;
  plane_id: mongoose.Types.ObjectId;
  date: Date;
  start_time: string;
  end_time: string;
  duration: number;
  type: string;
  status: string;
  notes?: string;
  [key: string]: any;
}

interface IPlane extends Document {
  _id: mongoose.Types.ObjectId;
  school_id: mongoose.Types.ObjectId;
  registration: string;
  [key: string]: any;
}

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

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const role = decoded?.role;

    // Check role-based access control
    if (role === 'student') {
      return NextResponse.json(
        { error: 'Forbidden: Students cannot view schedules' },
        { status: 403 }
      );
    }

    // If not a system admin, check school access
    if (role !== 'sys_admin') {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck !== null) {
        return schoolAccessCheck;
      }
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Find the schedule
    const ScheduleModelTyped = ScheduleModel as Model<ISchedule>;
    const schedule = await ScheduleModelTyped.findOne({
      _id: new mongoose.Types.ObjectId(params.scheduleId),
      school_id: new mongoose.Types.ObjectId(params.schoolId)
    }).exec();

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule' },
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

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const role = decoded?.role;

    // Check role-based access control
    if (role === 'student') {
      return NextResponse.json(
        { error: 'Forbidden: Students cannot update schedules' },
        { status: 403 }
      );
    }

    // If not a system admin, check school access
    if (role !== 'sys_admin') {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck !== null) {
        return schoolAccessCheck;
      }
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Find the schedule
    const ScheduleModelTyped = ScheduleModel as Model<ISchedule>;
    const schedule = await ScheduleModelTyped.findOne({
      _id: new mongoose.Types.ObjectId(params.scheduleId),
      school_id: new mongoose.Types.ObjectId(params.schoolId)
    }).exec();

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Store original values for comparison
    const originalDate = schedule.date;
    const originalStartTime = schedule.start_time;
    const originalEndTime = schedule.end_time;

    // Get request body
    const body = await request.json();

    // Update schedule
    const updatedSchedule = await ScheduleModelTyped.findByIdAndUpdate(
      params.scheduleId,
      { $set: body },
      { new: true, runValidators: true }
    ).exec();

    if (!updatedSchedule) {
      return NextResponse.json(
        { error: 'Failed to update schedule' },
        { status: 500 }
      );
    }

    // Check if date or time changed
    const dateChanged = originalDate.getTime() !== updatedSchedule.date.getTime();
    const startTimeChanged = originalStartTime !== updatedSchedule.start_time;
    const endTimeChanged = originalEndTime !== updatedSchedule.end_time;

    // If date or time changed, update associated flight log
    if (dateChanged || startTimeChanged || endTimeChanged) {
      const FlightLogModelTyped = FlightLog as Model<IFlightLog>;
      const flightLog = await FlightLogModelTyped.findOne({
        school_id: params.schoolId,
        student_id: updatedSchedule.student_id,
        instructor_id: updatedSchedule.instructor_id,
        date: originalDate,
        start_time: originalStartTime
      }).exec();

      if (flightLog) {
        // Update flight log with new schedule details
        const flightLogUpdates: any = {};

        if (dateChanged) {
          flightLogUpdates.date = updatedSchedule.date;
        }

        if (startTimeChanged) {
          flightLogUpdates.start_time = updatedSchedule.start_time;
        }

        if (endTimeChanged) {
          flightLogUpdates.end_time = updatedSchedule.end_time;
          // Recalculate duration if end time changed
          const start = new Date(`${updatedSchedule.date.toISOString().split('T')[0]}T${updatedSchedule.start_time}`);
          const end = new Date(`${updatedSchedule.date.toISOString().split('T')[0]}T${updatedSchedule.end_time}`);
          const durationMs = end.getTime() - start.getTime();
          flightLogUpdates.duration = Math.round(durationMs / (1000 * 60)); // Convert to minutes
        }

        // Update flight log status based on schedule status
        if (updatedSchedule.status === 'completed') {
          flightLogUpdates.status = 'Completed';
        } else if (updatedSchedule.status === 'canceled') {
          flightLogUpdates.status = 'Canceled';
        } else if (updatedSchedule.status === 'in-progress') {
          flightLogUpdates.status = 'In-Flight';
        } else {
          flightLogUpdates.status = 'Scheduled';
        }

        // Update type if changed
        if (updatedSchedule.type !== flightLog.type) {
          flightLogUpdates.type = updatedSchedule.type;
        }

        // Update plane if changed
        if (updatedSchedule.plane_id.toString() !== flightLog.plane_id.toString()) {
          flightLogUpdates.plane_id = updatedSchedule.plane_id;
          
          // Get new plane registration
          const PlaneModelTyped = Plane as Model<IPlane>;
          const newPlane = await PlaneModelTyped.findById(updatedSchedule.plane_id).exec();
          if (newPlane) {
            flightLogUpdates.plane_reg = newPlane.registration;
          }
        }

        // Only update if there are changes
        if (Object.keys(flightLogUpdates).length > 0) {
          await FlightLogModelTyped.findByIdAndUpdate(
            flightLog._id,
            { $set: flightLogUpdates },
            { new: true, runValidators: true }
          ).exec();
        }
      }
    }

    return NextResponse.json({
      message: 'Schedule updated successfully',
      schedule: updatedSchedule
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    return NextResponse.json(
      { error: 'Failed to update schedule' },
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

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const role = decoded?.role;

    // Check role-based access control
    if (role === 'student') {
      return NextResponse.json(
        { error: 'Forbidden: Students cannot delete schedules' },
        { status: 403 }
      );
    }

    // If not a system admin, check school access
    if (role !== 'sys_admin') {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck !== null) {
        return schoolAccessCheck;
      }
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.scheduleId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Find the schedule
    const ScheduleModelTyped = ScheduleModel as Model<ISchedule>;
    const schedule = await ScheduleModelTyped.findOne({
      _id: new mongoose.Types.ObjectId(params.scheduleId),
      school_id: new mongoose.Types.ObjectId(params.schoolId)
    }).exec();

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Delete the schedule
    await ScheduleModelTyped.findByIdAndDelete(params.scheduleId).exec();

    return NextResponse.json({
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
} 