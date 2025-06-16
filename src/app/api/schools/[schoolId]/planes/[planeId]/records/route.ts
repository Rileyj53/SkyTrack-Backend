import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import PlaneRecord from '@/models/PlaneRecord';
import Plane from '@/models/Plane';

// Security configuration for plane records endpoints
const PLANE_RECORDS_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // Required for POST/PUT/DELETE operations
  allowedRoles: ['sys_admin', 'school_admin', 'instructor'],
  requireSchoolAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET /api/schools/[schoolId]/planes/[planeId]/records - List all records for a plane
export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing plane records list request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    planeId: params.planeId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate school ID and plane ID
  if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid school ID format provided',
      auditId: securityContext.auditId,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid school ID format',
        code: 'INVALID_SCHOOL_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  if (!mongoose.Types.ObjectId.isValid(params.planeId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid plane ID format provided',
      auditId: securityContext.auditId,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid plane ID format',
        code: 'INVALID_PLANE_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Verify plane belongs to the school
  const plane = await (Plane as any).findOne({ 
    _id: params.planeId, 
    school_id: params.schoolId 
  }).lean();

  if (!plane) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Plane not found or does not belong to school',
      auditId: securityContext.auditId,
      planeId: params.planeId,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Plane not found or does not belong to this school',
        code: 'PLANE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
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
  const records = await (PlaneRecord as any).find(query)
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(offset)
    .lean();

  // Get total count
  const total = await (PlaneRecord as any).countDocuments(query);

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

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Plane records list request completed successfully',
    auditId: securityContext.auditId,
    planeId: params.planeId,
    recordsCount: transformedRecords.length,
    totalRecords: total,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Plane records retrieved successfully',
    data: {
      records: transformedRecords,
      total,
      limit,
      offset
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PLANE_RECORDS_SECURITY_CONFIG);

// POST /api/schools/[schoolId]/planes/[planeId]/records - Create a new record for a plane
export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing plane record creation request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    planeId: params.planeId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins and instructors can create records
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin', 'instructor'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to create plane record',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to create plane records',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate school ID and plane ID
  if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid school ID format provided for record creation',
      auditId: securityContext.auditId,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid school ID format',
        code: 'INVALID_SCHOOL_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  if (!mongoose.Types.ObjectId.isValid(params.planeId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid plane ID format provided for record creation',
      auditId: securityContext.auditId,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid plane ID format',
        code: 'INVALID_PLANE_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Verify plane belongs to the school
  const plane = await (Plane as any).findOne({ 
    _id: params.planeId, 
    school_id: params.schoolId 
  }).lean();

  if (!plane) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Plane not found or does not belong to school for record creation',
      auditId: securityContext.auditId,
      planeId: params.planeId,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Plane not found or does not belong to this school',
        code: 'PLANE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Get request body
  const body = await request.json();

  // Validate required fields
  if (!body.description) {
    return NextResponse.json({
      error: {
        message: 'Missing required field: description',
        code: 'MISSING_REQUIRED_FIELD',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate record_type if provided
  if (body.record_type && !['maintenance', 'airworthiness', 'service_bulletin'].includes(body.record_type)) {
    return NextResponse.json({
      error: {
        message: 'Invalid record_type. Must be one of: maintenance, airworthiness, service_bulletin',
        code: 'INVALID_RECORD_TYPE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
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

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Plane record created successfully',
    auditId: securityContext.auditId,
    recordId: record._id,
    planeId: params.planeId,
    recordType: record.record_type,
    createdBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Record created successfully',
    data: {
      record: transformedRecord
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }, { status: 201 });
}, PLANE_RECORDS_SECURITY_CONFIG);

// PUT /api/schools/[schoolId]/planes/[planeId]/records - Update multiple records (bulk update)
export const PUT = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing plane records bulk update request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    planeId: params.planeId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can bulk update records
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to bulk update plane records',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to bulk update plane records',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate school ID and plane ID
  if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid school ID format provided for bulk update',
      auditId: securityContext.auditId,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid school ID format',
        code: 'INVALID_SCHOOL_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  if (!mongoose.Types.ObjectId.isValid(params.planeId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid plane ID format provided for bulk update',
      auditId: securityContext.auditId,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid plane ID format',
        code: 'INVALID_PLANE_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Verify plane belongs to the school
  const plane = await (Plane as any).findOne({ 
    _id: params.planeId, 
    school_id: params.schoolId 
  }).lean();

  if (!plane) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Plane not found or does not belong to school for bulk update',
      auditId: securityContext.auditId,
      planeId: params.planeId,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Plane not found or does not belong to this school',
        code: 'PLANE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  const body = await request.json();

  // Support bulk update by status or record_type
  const { filter, update } = body;

  if (!filter || !update) {
    return NextResponse.json({
      error: {
        message: 'Missing required fields: filter and update',
        code: 'MISSING_REQUIRED_FIELDS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Build the filter query
  const query: any = { plane_id: params.planeId };
  if (filter.record_type) query.record_type = filter.record_type;
  if (filter.status) query.status = filter.status;

  // Validate record_type if provided in update
  if (update.record_type && !['maintenance', 'airworthiness', 'service_bulletin'].includes(update.record_type)) {
    return NextResponse.json({
      error: {
        message: 'Invalid record_type. Must be one of: maintenance, airworthiness, service_bulletin',
        code: 'INVALID_RECORD_TYPE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
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
  const result = await (PlaneRecord as any).updateMany(query, updateObj);

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Plane records bulk update completed successfully',
    auditId: securityContext.auditId,
    planeId: params.planeId,
    updatedCount: result.modifiedCount,
    updatedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Records updated successfully',
    data: {
      updated_count: result.modifiedCount
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PLANE_RECORDS_SECURITY_CONFIG);

// DELETE /api/schools/[schoolId]/planes/[planeId]/records - Delete multiple records (bulk delete)
export const DELETE = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing plane records bulk deletion request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    planeId: params.planeId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can bulk delete records
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to bulk delete plane records',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to bulk delete plane records',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate school ID and plane ID
  if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid school ID format provided for bulk deletion',
      auditId: securityContext.auditId,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid school ID format',
        code: 'INVALID_SCHOOL_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  if (!mongoose.Types.ObjectId.isValid(params.planeId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid plane ID format provided for bulk deletion',
      auditId: securityContext.auditId,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid plane ID format',
        code: 'INVALID_PLANE_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Verify plane belongs to the school
  const plane = await (Plane as any).findOne({ 
    _id: params.planeId, 
    school_id: params.schoolId 
  }).lean();

  if (!plane) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Plane not found or does not belong to school for bulk deletion',
      auditId: securityContext.auditId,
      planeId: params.planeId,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Plane not found or does not belong to this school',
        code: 'PLANE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
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
      return NextResponse.json({
        error: {
          message: 'No valid record IDs provided',
          code: 'INVALID_RECORD_IDS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
    query._id = { $in: validIds };
  } else {
    // Delete by filters
    if (recordType) query.record_type = recordType;
    if (status) query.status = status;
  }

  // Perform deletion
  const result = await (PlaneRecord as any).deleteMany(query);

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Plane records bulk deletion completed successfully',
    auditId: securityContext.auditId,
    planeId: params.planeId,
    deletedCount: result.deletedCount,
    deletedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Records deleted successfully',
    data: {
      deleted_count: result.deletedCount
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PLANE_RECORDS_SECURITY_CONFIG); 