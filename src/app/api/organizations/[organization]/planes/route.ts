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
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET /api/organizations/[organizationId]/planes - List all planes for an organization
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing planes list request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate organization ID
  if (!mongoose.Types.ObjectId.isValid(params.organization)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID format provided',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID format',
        code: 'INVALID_ORGANIZATION_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find all planes for this organization (still using organization_id in database for now)
  const planes = await (Plane as any).find({ organization_id: params.organization }).lean();
  
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
    organizationId: params.organization,
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

// POST /api/organizations/[organizationId]/planes - Create a new plane for an organization
export const POST = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing plane creation request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
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
      organizationId: params.organization,
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

  // Validate organization ID
  if (!mongoose.Types.ObjectId.isValid(params.organization)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID format provided for plane creation',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID format',
        code: 'INVALID_ORGANIZATION_ID',
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

  // Check if plane with registration already exists (still using organization_id in database for now)
  const existingPlane = await (Plane as any).findOne({
    registration: body.registration.toUpperCase(),
    organization_id: params.organization
  }).lean();

  if (existingPlane) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Plane with registration already exists in organization',
      auditId: securityContext.auditId,
      registration: body.registration,
      organizationId: params.organization,
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

  // Create new plane (still using organization_id in database for now)
  const plane = new Plane({
    ...body,
    registration: body.registration.toUpperCase(),
    organization_id: params.organization,
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
    organizationId: params.organization,
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