import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { checkSchoolAccess } from '@/middleware/schoolAccess';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import PlaneRecord from '@/models/PlaneRecord';
import Plane from '@/models/Plane';

// Connect to MongoDB
connectDB();

// GET /api/schools/[schoolId]/planes/[planeId]/records/[recordId] - Get a specific record
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string; recordId: string } }
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
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID format' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(params.planeId)) {
      return NextResponse.json(
        { error: 'Invalid plane ID format' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(params.recordId)) {
      return NextResponse.json(
        { error: 'Invalid record ID format' },
        { status: 400 }
      );
    }

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // If not a system admin, check school access
    if (!isSystemAdmin) {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck) {
        return schoolAccessCheck;
      }
    }

    // Verify plane belongs to the school
    const plane = await Plane.findOne({ 
      _id: params.planeId, 
      school_id: params.schoolId 
    }).lean();

    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found or does not belong to this school' },
        { status: 404 }
      );
    }

    // Find the specific record
    const record = await PlaneRecord.findOne({
      _id: params.recordId,
      plane_id: params.planeId
    }).lean();

    if (!record) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    // Transform the response
    const transformedRecord = {
      id: record._id,
      plane_id: record.plane_id,
      record_type: record.record_type,
      title: record.title,
      description: record.description,
      status: record.status,
      date: record.date,
      nextDue: record.nextDue,
      aircraftHours: record.aircraftHours,
      partsReplaced: record.partsReplaced || [],
      notes: record.notes,
      attachments: record.attachments || [],
      created_at: record.created_at,
      updated_at: record.updated_at
    };

    return NextResponse.json({ record: transformedRecord });
  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/planes/[planeId]/records/[recordId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId]/planes/[planeId]/records/[recordId] - Update a specific record
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string; recordId: string } }
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
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID format' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(params.planeId)) {
      return NextResponse.json(
        { error: 'Invalid plane ID format' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(params.recordId)) {
      return NextResponse.json(
        { error: 'Invalid record ID format' },
        { status: 400 }
      );
    }

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // If not a system admin, check school access
    if (!isSystemAdmin) {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck) {
        return schoolAccessCheck;
      }
    }

    // Verify plane belongs to the school
    const plane = await Plane.findOne({ 
      _id: params.planeId, 
      school_id: params.schoolId 
    }).lean();

    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found or does not belong to this school' },
        { status: 404 }
      );
    }

    // Get request body
    const body = await request.json();

    // Validate record_type if provided
    if (body.record_type && !['maintenance', 'airworthiness', 'service_bulletin'].includes(body.record_type)) {
      return NextResponse.json(
        { error: 'Invalid record_type. Must be one of: maintenance, airworthiness, service_bulletin' },
        { status: 400 }
      );
    }

    // Build update object
    const updateObj: any = { updated_at: new Date() };
    if (body.record_type !== undefined) updateObj.record_type = body.record_type;
    if (body.title !== undefined) updateObj.title = body.title;
    if (body.description !== undefined) updateObj.description = body.description;
    if (body.status !== undefined) updateObj.status = body.status;
    if (body.date !== undefined) updateObj.date = body.date ? new Date(body.date) : null;
    if (body.nextDue !== undefined) updateObj.nextDue = body.nextDue ? new Date(body.nextDue) : null;
    if (body.aircraftHours !== undefined) updateObj.aircraftHours = body.aircraftHours;
    if (body.partsReplaced !== undefined) updateObj.partsReplaced = body.partsReplaced;
    if (body.notes !== undefined) updateObj.notes = body.notes;
    if (body.attachments !== undefined) updateObj.attachments = body.attachments;

    // Update the record
    const record = await PlaneRecord.findOneAndUpdate(
      { _id: params.recordId, plane_id: params.planeId },
      updateObj,
      { new: true, runValidators: true }
    ).lean();

    if (!record) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    // Transform the response
    const transformedRecord = {
      id: record._id,
      plane_id: record.plane_id,
      record_type: record.record_type,
      title: record.title,
      description: record.description,
      status: record.status,
      date: record.date,
      nextDue: record.nextDue,
      aircraftHours: record.aircraftHours,
      partsReplaced: record.partsReplaced || [],
      notes: record.notes,
      attachments: record.attachments || [],
      created_at: record.created_at,
      updated_at: record.updated_at
    };

    return NextResponse.json({
      message: 'Record updated successfully',
      record: transformedRecord
    });
  } catch (error) {
    console.error('Error in PUT /api/schools/[schoolId]/planes/[planeId]/records/[recordId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/planes/[planeId]/records/[recordId] - Delete a specific record
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string; recordId: string } }
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
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID format' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(params.planeId)) {
      return NextResponse.json(
        { error: 'Invalid plane ID format' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(params.recordId)) {
      return NextResponse.json(
        { error: 'Invalid record ID format' },
        { status: 400 }
      );
    }

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // If not a system admin, check school access
    if (!isSystemAdmin) {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck) {
        return schoolAccessCheck;
      }
    }

    // Verify plane belongs to the school
    const plane = await Plane.findOne({ 
      _id: params.planeId, 
      school_id: params.schoolId 
    }).lean();

    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found or does not belong to this school' },
        { status: 404 }
      );
    }

    // Delete the record
    const result = await PlaneRecord.findOneAndDelete({
      _id: params.recordId,
      plane_id: params.planeId
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Record deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/schools/[schoolId]/planes/[planeId]/records/[recordId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 