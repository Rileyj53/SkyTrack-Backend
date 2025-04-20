import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { checkSchoolAccess } from '@/middleware/schoolAccess';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import mongoose, { Model, Document } from 'mongoose';
import Plane from '@/models/Plane';
import MaintenanceSchedule from '@/models/MaintenanceSchedule';

// Connect to MongoDB
connectDB();

// Define interfaces for type safety
interface IPlane extends Document {
  _id: mongoose.Types.ObjectId;
  school_id: mongoose.Types.ObjectId;
  registration: string;
  [key: string]: any;
}

interface IMaintenanceSchedule extends Document {
  _id: mongoose.Types.ObjectId;
  plane_id: mongoose.Types.ObjectId;
  school_id: mongoose.Types.ObjectId;
  maintenance_type: string;
  frequency_hours: number;
  frequency_days: number;
  last_maintenance: Date;
  next_maintenance: Date;
  notes?: string;
  [key: string]: any;
}

// GET /api/schools/[schoolId]/planes/[planeId]/maintenance-schedule
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string } }
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
        { error: 'Forbidden: Students cannot view maintenance schedules' },
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

    // Find the plane and ensure it belongs to the school
    const PlaneModel = Plane as Model<IPlane>;
    const plane = await PlaneModel.findById(params.planeId).exec();
    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found' },
        { status: 404 }
      );
    }

    // Verify the plane belongs to the school
    if (plane.school_id.toString() !== params.schoolId) {
      return NextResponse.json(
        { error: 'Plane does not belong to this school' },
        { status: 403 }
      );
    }

    // Find maintenance schedule
    const MaintenanceScheduleModel = MaintenanceSchedule as Model<IMaintenanceSchedule>;
    const schedule = await MaintenanceScheduleModel.findOne({
      plane_id: params.planeId
    }).exec();

    if (!schedule) {
      return NextResponse.json(
        { error: 'Maintenance schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Error fetching maintenance schedule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch maintenance schedule' },
      { status: 500 }
    );
  }
}

// POST /api/schools/[schoolId]/planes/[planeId]/maintenance-schedule
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string } }
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
        { error: 'Forbidden: Students cannot create maintenance schedules' },
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

    // Find the plane and ensure it belongs to the school
    const PlaneModel = Plane as Model<IPlane>;
    const plane = await PlaneModel.findById(params.planeId).exec();
    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found' },
        { status: 404 }
      );
    }

    // Verify the plane belongs to the school
    if (plane.school_id.toString() !== params.schoolId) {
      return NextResponse.json(
        { error: 'Plane does not belong to this school' },
        { status: 403 }
      );
    }

    // Find existing maintenance schedule
    const MaintenanceScheduleModel = MaintenanceSchedule as Model<IMaintenanceSchedule>;
    const existingSchedule = await MaintenanceScheduleModel.findOne({
      plane_id: params.planeId
    }).exec();

    if (existingSchedule) {
      return NextResponse.json(
        { error: 'Maintenance schedule already exists for this plane' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json();

    // Create new maintenance schedule
    const schedule = new MaintenanceScheduleModel({
      plane_id: params.planeId,
      school_id: params.schoolId,
      maintenance_type: body.maintenance_type,
      frequency_hours: body.frequency_hours,
      frequency_days: body.frequency_days,
      last_maintenance: body.last_maintenance,
      next_maintenance: body.next_maintenance,
      notes: body.notes
    });

    await schedule.save();

    return NextResponse.json({
      message: 'Maintenance schedule created successfully',
      schedule
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating maintenance schedule:', error);
    return NextResponse.json(
      { error: 'Failed to create maintenance schedule' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId]/planes/[planeId]/maintenance-schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string } }
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
        { error: 'Forbidden: Students cannot update maintenance schedules' },
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

    // Find the plane and ensure it belongs to the school
    const PlaneModel = Plane as Model<IPlane>;
    const plane = await PlaneModel.findById(params.planeId).exec();
    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found' },
        { status: 404 }
      );
    }

    // Verify the plane belongs to the school
    if (plane.school_id.toString() !== params.schoolId) {
      return NextResponse.json(
        { error: 'Plane does not belong to this school' },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();

    // Find and update the maintenance schedule
    const MaintenanceScheduleModel = MaintenanceSchedule as Model<IMaintenanceSchedule>;
    const schedule = await MaintenanceScheduleModel.findOneAndUpdate(
      { plane_id: params.planeId },
      { $set: body },
      { new: true, runValidators: true }
    ).exec();

    if (!schedule) {
      return NextResponse.json(
        { error: 'Maintenance schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Maintenance schedule updated successfully',
      schedule
    });
  } catch (error) {
    console.error('Error updating maintenance schedule:', error);
    return NextResponse.json(
      { error: 'Failed to update maintenance schedule' },
      { status: 500 }
    );
  }
} 