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

// GET /api/schools/[schoolId]/planes/[planeId]/records - List all records for a plane
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

    // Validate school ID and plane ID
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

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const recordType = searchParams.get('record_type');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    const query: any = { plane_id: params.planeId };
    if (recordType) query.record_type = recordType;
    if (status) query.status = status;

    // Find records with pagination
    const records = await PlaneRecord.find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    // Get total count
    const total = await PlaneRecord.countDocuments(query);

    // Transform the response
    const transformedRecords = records.map(record => ({
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
    }));

    return NextResponse.json({
      records: transformedRecords,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/planes/[planeId]/records:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/schools/[schoolId]/planes/[planeId]/records - Create a new record for a plane
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

    // Validate school ID and plane ID
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

    // Validate required fields
    if (!body.description) {
      return NextResponse.json(
        { error: 'Missing required field: description' },
        { status: 400 }
      );
    }

    // Validate record_type if provided
    if (body.record_type && !['maintenance', 'airworthiness', 'service_bulletin'].includes(body.record_type)) {
      return NextResponse.json(
        { error: 'Invalid record_type. Must be one of: maintenance, airworthiness, service_bulletin' },
        { status: 400 }
      );
    }

    // Create new record
    const record = new PlaneRecord({
      plane_id: params.planeId,
      record_type: body.record_type,
      title: body.title,
      description: body.description,
      status: body.status,
      date: body.date ? new Date(body.date) : undefined,
      nextDue: body.nextDue ? new Date(body.nextDue) : undefined,
      aircraftHours: body.aircraftHours,
      partsReplaced: body.partsReplaced || [],
      notes: body.notes,
      attachments: body.attachments || []
    });

    await record.save();

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
      partsReplaced: record.partsReplaced,
      notes: record.notes,
      attachments: record.attachments,
      created_at: record.created_at,
      updated_at: record.updated_at
    };

    return NextResponse.json(
      { message: 'Record created successfully', record: transformedRecord },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/schools/[schoolId]/planes/[planeId]/records:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId]/planes/[planeId]/records - Update multiple records (bulk update)
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

    // Validate school ID and plane ID
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

    const body = await request.json();

    // Support bulk update by status or record_type
    const { filter, update } = body;

    if (!filter || !update) {
      return NextResponse.json(
        { error: 'Missing required fields: filter and update' },
        { status: 400 }
      );
    }

    // Build the filter query
    const query: any = { plane_id: params.planeId };
    if (filter.record_type) query.record_type = filter.record_type;
    if (filter.status) query.status = filter.status;

    // Validate record_type if provided in update
    if (update.record_type && !['maintenance', 'airworthiness', 'service_bulletin'].includes(update.record_type)) {
      return NextResponse.json(
        { error: 'Invalid record_type. Must be one of: maintenance, airworthiness, service_bulletin' },
        { status: 400 }
      );
    }

    // Prepare update object
    const updateObj: any = { updated_at: new Date() };
    if (update.record_type !== undefined) updateObj.record_type = update.record_type;
    if (update.title !== undefined) updateObj.title = update.title;
    if (update.status !== undefined) updateObj.status = update.status;
    if (update.date !== undefined) updateObj.date = update.date ? new Date(update.date) : null;
    if (update.nextDue !== undefined) updateObj.nextDue = update.nextDue ? new Date(update.nextDue) : null;
    if (update.aircraftHours !== undefined) updateObj.aircraftHours = update.aircraftHours;
    if (update.notes !== undefined) updateObj.notes = update.notes;

    // Perform bulk update
    const result = await PlaneRecord.updateMany(query, updateObj);

    return NextResponse.json({
      message: 'Records updated successfully',
      updated_count: result.modifiedCount
    });
  } catch (error) {
    console.error('Error in PUT /api/schools/[schoolId]/planes/[planeId]/records:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/planes/[planeId]/records - Delete multiple records (bulk delete)
export async function DELETE(
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

    // Validate school ID and plane ID
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

    // Get query parameters or request body for filtering
    const { searchParams } = new URL(request.url);
    const recordType = searchParams.get('record_type');
    const status = searchParams.get('status');
    const recordIds = searchParams.get('ids')?.split(',');

    // Build query
    const query: any = { plane_id: params.planeId };
    
    if (recordIds && recordIds.length > 0) {
      // Delete specific records by IDs
      const validIds = recordIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length === 0) {
        return NextResponse.json(
          { error: 'No valid record IDs provided' },
          { status: 400 }
        );
      }
      query._id = { $in: validIds };
    } else {
      // Delete by filters
      if (recordType) query.record_type = recordType;
      if (status) query.status = status;
    }

    // Perform deletion
    const result = await PlaneRecord.deleteMany(query);

    return NextResponse.json({
      message: 'Records deleted successfully',
      deleted_count: result.deletedCount
    });
  } catch (error) {
    console.error('Error in DELETE /api/schools/[schoolId]/planes/[planeId]/records:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 