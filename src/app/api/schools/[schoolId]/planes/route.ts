import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import Plane from '@/models/Plane';

// Security configuration for plane endpoints
const PLANE_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // Required for POST operations
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

// GET /api/schools/[schoolId]/planes - List all planes for a school
export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing planes list request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate school ID
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

  // Find all planes for this school
  const planes = await (Plane as any).find({ school_id: params.schoolId }).lean();
  
  // Transform the response to match the expected format
  const transformedPlanes = planes.map(plane => ({
    id: plane._id,
    registration: plane.registration,
    type: plane.type,
    aircraftModel: plane.aircraftModel,
    year: plane.year,
    engineHours: plane.engineHours,
    tach_time: plane.tach_time,
    hopps_time: plane.hopps_time,
    last_maintenance: plane.last_maintenance,
    next_maintenance: plane.next_maintenance,
    status: plane.status,
    hourlyRates: plane.hourlyRates,
    specialRates: plane.specialRates,
    utilization: plane.utilization,
    location: plane.location,
    notes: plane.notes,
    total_hours: plane.total_hours
  }));

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Planes list request completed successfully',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    planesCount: transformedPlanes.length,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));
  
  return NextResponse.json({
    success: true,
    message: 'Planes retrieved successfully',
    data: {
      planes: transformedPlanes
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PLANE_SECURITY_CONFIG);

// POST /api/schools/[schoolId]/planes - Create a new plane for a school
export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing plane creation request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can create planes
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to create plane',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to create planes',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate school ID
  if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid school ID format provided for plane creation',
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

  // Get request body
  const body = await request.json();

  // Validate required fields
  const requiredFields = [
    'registration',
    'type',
    'aircraftModel',
    'year',
    'engineHours',
    'status',
    'location',
    'hourlyRates'
  ];

  for (const field of requiredFields) {
    if (!body[field]) {
      return NextResponse.json({
        error: {
          message: `Missing required field: ${field}`,
          code: 'MISSING_REQUIRED_FIELD',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
  }

  // Validate hourlyRates fields
  const requiredHourlyRates = ['wet', 'dry', 'block', 'instruction', 'weekend', 'solo', 'checkride'];
  for (const rate of requiredHourlyRates) {
    if (body.hourlyRates[rate] === undefined) {
      return NextResponse.json({
        error: {
          message: `Missing required hourly rate: ${rate}`,
          code: 'MISSING_HOURLY_RATE',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
  }

  // Check if plane with registration already exists
  const existingPlane = await (Plane as any).findOne({
    registration: body.registration.toUpperCase(),
    school_id: params.schoolId
  }).lean();

  if (existingPlane) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Plane with registration already exists in school',
      auditId: securityContext.auditId,
      registration: body.registration,
      schoolId: params.schoolId,
      existingPlaneId: existingPlane._id,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'A plane with this registration already exists',
        code: 'PLANE_EXISTS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 409 });
  }

  // Create new plane
  const plane = new Plane({
    ...body,
    registration: body.registration.toUpperCase(),
    school_id: params.schoolId,
    // Ensure specialRates is an array
    specialRates: body.specialRates || []
  });

  await plane.save();

  // Transform the response to match the expected format
  const transformedPlane = {
    id: plane._id,
    registration: plane.registration,
    type: plane.type,
    aircraftModel: plane.aircraftModel,
    year: plane.year,
    engineHours: plane.engineHours,
    tach_time: plane.tach_time,
    hopps_time: plane.hopps_time,
    last_maintenance: plane.last_maintenance,
    next_maintenance: plane.next_maintenance,
    status: plane.status,
    hourlyRates: plane.hourlyRates,
    specialRates: plane.specialRates,
    utilization: plane.utilization,
    location: plane.location,
    notes: plane.notes,
    total_hours: plane.total_hours
  };

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Plane created successfully',
    auditId: securityContext.auditId,
    planeId: plane._id,
    registration: plane.registration,
    schoolId: params.schoolId,
    createdBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Plane created successfully',
    data: {
      plane: transformedPlane
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }, { status: 201 });
}, PLANE_SECURITY_CONFIG); 