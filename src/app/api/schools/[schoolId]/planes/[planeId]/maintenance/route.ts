import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { checkSchoolAccess } from '@/middleware/schoolAccess';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import mongoose, { Model, Document } from 'mongoose';
import Plane from '@/models/Plane';
import MaintenanceLog, { IMaintenanceLog } from '@/models/MaintenanceLog';

// Connect to MongoDB
connectDB();

// Define interface for type safety
interface IPlane extends Document {
  _id: mongoose.Types.ObjectId;
  school_id: mongoose.Types.ObjectId;
  registration: string;
  [key: string]: any;
}

// GET /api/schools/[schoolId]/planes/[planeId]/maintenance
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
        { error: 'Forbidden: Students cannot view maintenance records' },
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

    // Verify plane belongs to school
    const PlaneModel = Plane as Model<IPlane>;
    const plane = await PlaneModel.findOne({
      _id: new mongoose.Types.ObjectId(params.planeId),
      school_id: new mongoose.Types.ObjectId(params.schoolId)
    }).exec();

    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found or does not belong to this school' },
        { status: 404 }
      );
    }

    // Get maintenance records
    const MaintenanceLogModel = MaintenanceLog as Model<IMaintenanceLog>;
    const maintenanceRecords = await MaintenanceLogModel.find({
      aircraftId: new mongoose.Types.ObjectId(params.planeId)
    }).sort({ date: -1 }).exec();

    return NextResponse.json(maintenanceRecords);
  } catch (error) {
    console.error('Error fetching maintenance records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch maintenance records' },
      { status: 500 }
    );
  }
}

// POST /api/schools/[schoolId]/planes/[planeId]/maintenance
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
        { error: 'Forbidden: Students cannot create maintenance records' },
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

    // Verify plane belongs to school
    const PlaneModel = Plane as Model<IPlane>;
    const plane = await PlaneModel.findOne({
      _id: new mongoose.Types.ObjectId(params.planeId),
      school_id: new mongoose.Types.ObjectId(params.schoolId)
    }).exec();

    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found or does not belong to this school' },
        { status: 404 }
      );
    }

    // Get request body
    const body = await request.json();

    // Create new maintenance record
    const MaintenanceLogModel = MaintenanceLog as Model<IMaintenanceLog>;
    const maintenance = new MaintenanceLogModel({
      aircraftId: new mongoose.Types.ObjectId(params.planeId),
      date: new Date(body.date),
      type: body.type,
      description: body.description,
      workPerformed: body.workPerformed,
      partsReplaced: body.partsReplaced,
      technician: body.technician,
      aircraftHours: body.aircraftHours,
      nextDue: body.nextDue,
      status: body.status,
      referenceDocuments: body.referenceDocuments,
      notes: body.notes
    });

    await maintenance.save();

    return NextResponse.json({
      message: 'Maintenance record created successfully',
      maintenance
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating maintenance record:', error);
    return NextResponse.json(
      { error: 'Failed to create maintenance record' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId]/planes/[planeId]/maintenance/[logId]
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string; logId: string } }
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
        { error: 'Forbidden: Students cannot update maintenance records' },
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

    // Verify plane belongs to school
    const PlaneModel = Plane as Model<IPlane>;
    const plane = await PlaneModel.findOne({
      _id: new mongoose.Types.ObjectId(params.planeId),
      school_id: new mongoose.Types.ObjectId(params.schoolId)
    }).exec();

    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found or does not belong to this school' },
        { status: 404 }
      );
    }

    // Find and update maintenance record
    const MaintenanceLogModel = MaintenanceLog as Model<IMaintenanceLog>;
    const maintenance = await MaintenanceLogModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(params.logId),
        aircraftId: new mongoose.Types.ObjectId(params.planeId)
      },
      { $set: await request.json() },
      { new: true, runValidators: true }
    ).exec();

    if (!maintenance) {
      return NextResponse.json(
        { error: 'Maintenance record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Maintenance record updated successfully',
      maintenance
    });
  } catch (error) {
    console.error('Error updating maintenance record:', error);
    return NextResponse.json(
      { error: 'Failed to update maintenance record' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/planes/[planeId]/maintenance/[logId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string; logId: string } }
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
        { error: 'Forbidden: Students cannot delete maintenance records' },
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

    // Verify plane belongs to school
    const PlaneModel = Plane as Model<IPlane>;
    const plane = await PlaneModel.findOne({
      _id: new mongoose.Types.ObjectId(params.planeId),
      school_id: new mongoose.Types.ObjectId(params.schoolId)
    }).exec();

    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found or does not belong to this school' },
        { status: 404 }
      );
    }

    // Find and delete maintenance record
    const MaintenanceLogModel = MaintenanceLog as Model<IMaintenanceLog>;
    const maintenance = await MaintenanceLogModel.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(params.logId),
      aircraftId: new mongoose.Types.ObjectId(params.planeId)
    }).exec();

    if (!maintenance) {
      return NextResponse.json(
        { error: 'Maintenance record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Maintenance record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting maintenance record:', error);
    return NextResponse.json(
      { error: 'Failed to delete maintenance record' },
      { status: 500 }
    );
  }
} 