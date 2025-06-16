import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import PlaneRecord from '@/models/PlaneRecord';
import Plane from '@/models/Plane';

// Security configuration for individual plane record endpoints
const PLANE_RECORD_DETAIL_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // Required for PUT/DELETE operations
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

// GET /api/schools/[schoolId]/planes/[planeId]/records/[recordId] - Get a specific record
export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing plane record details request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    planeId: params.planeId,
    recordId: params.recordId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
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

  if (!mongoose.Types.ObjectId.isValid(params.recordId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid record ID format provided',
      auditId: securityContext.auditId,
      recordId: params.recordId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid record ID format',
        code: 'INVALID_RECORD_ID',
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

  // Find the specific record
  const record = await (PlaneRecord as any).findOne({
    _id: params.recordId,
    plane_id: params.planeId
  }).lean();

  if (!record) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Plane record not found',
      auditId: securityContext.auditId,
      recordId: params.recordId,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Record not found',
        code: 'RECORD_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
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

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Plane record details request completed successfully',
    auditId: securityContext.auditId,
    recordId: params.recordId,
    recordType: record.record_type,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Record retrieved successfully',
    data: {
      record: transformedRecord
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PLANE_RECORD_DETAIL_SECURITY_CONFIG);

// PUT /api/schools/[schoolId]/planes/[planeId]/records/[recordId] - Update a specific record
export const PUT = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing plane record update request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    planeId: params.planeId,
    recordId: params.recordId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins and instructors can update records
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin', 'instructor'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to update plane record',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      recordId: params.recordId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to update plane records',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid school ID format provided for record update',
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
      message: 'Invalid plane ID format provided for record update',
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

  if (!mongoose.Types.ObjectId.isValid(params.recordId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid record ID format provided for record update',
      auditId: securityContext.auditId,
      recordId: params.recordId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid record ID format',
        code: 'INVALID_RECORD_ID',
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
      message: 'Plane not found or does not belong to school for record update',
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
  const record = await (PlaneRecord as any).findOneAndUpdate(
    { _id: params.recordId, plane_id: params.planeId },
    updateObj,
    { new: true, runValidators: true }
  ).lean();

  if (!record) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Record not found for update',
      auditId: securityContext.auditId,
      recordId: params.recordId,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Record not found',
        code: 'RECORD_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
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

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Plane record updated successfully',
    auditId: securityContext.auditId,
    recordId: params.recordId,
    recordType: record.record_type,
    updatedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Record updated successfully',
    data: {
      record: transformedRecord
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PLANE_RECORD_DETAIL_SECURITY_CONFIG);

// DELETE /api/schools/[schoolId]/planes/[planeId]/records/[recordId] - Delete a specific record
export const DELETE = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing plane record deletion request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    planeId: params.planeId,
    recordId: params.recordId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can delete records
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to delete plane record',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      recordId: params.recordId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to delete plane records',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid school ID format provided for record deletion',
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
      message: 'Invalid plane ID format provided for record deletion',
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

  if (!mongoose.Types.ObjectId.isValid(params.recordId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid record ID format provided for record deletion',
      auditId: securityContext.auditId,
      recordId: params.recordId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid record ID format',
        code: 'INVALID_RECORD_ID',
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
      message: 'Plane not found or does not belong to school for record deletion',
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

  // Delete the record
  const result = await (PlaneRecord as any).findOneAndDelete({
    _id: params.recordId,
    plane_id: params.planeId
  });

  if (!result) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Record not found for deletion',
      auditId: securityContext.auditId,
      recordId: params.recordId,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Record not found',
        code: 'RECORD_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Plane record deleted successfully',
    auditId: securityContext.auditId,
    recordId: params.recordId,
    recordType: result.record_type,
    planeId: params.planeId,
    deletedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Record deleted successfully',
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PLANE_RECORD_DETAIL_SECURITY_CONFIG); 