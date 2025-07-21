import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import Plane from '@/models/Plane';

// Security configuration for individual plane endpoints
const PLANE_DETAIL_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // Required for PUT/DELETE operations
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

// GET /api/organizations/[organizationId]/planes/[planeId] - Get a specific plane
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, planeId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing plane details request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    planeId: params.planeId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(params.planeId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid ID format provided',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find plane by ID
  const plane = await (Plane as any).findById(params.planeId).lean();
  if (!plane) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Plane not found',
      auditId: securityContext.auditId,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Plane not found',
        code: 'PLANE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Check if plane belongs to organization (still using organization_id in database for now)
  if (plane.organization_id.toString() !== params.organization) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Plane does not belong to specified organization',
      auditId: securityContext.auditId,
      planeId: params.planeId,
      planeSchoolId: plane.organization_id,
      requestedOrganizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Plane not found in this organization',
        code: 'PLANE_ORGANIZATION_MISMATCH',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Transform the response to match the expected format
  const transformedPlane = {
    id: plane._id,
    registration: plane.registration,
    type: plane.type,
    model: plane.model,
    year: plane.year,
    engineHours: plane.engineHours,
    tach_time: plane.tach_time,
    hopps_time: plane.hopps_time,
    lastMaintenance: plane.lastMaintenance,
    nextMaintenance: plane.nextMaintenance,
    status: plane.status,
    hourlyRates: plane.hourlyRates,
    specialRates: plane.specialRates,
    utilization: plane.utilization,
    location: plane.location,
    notes: plane.notes
  };

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Plane details request completed successfully',
    auditId: securityContext.auditId,
    planeId: params.planeId,
    registration: plane.registration,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Plane details retrieved successfully',
    data: {
      plane: transformedPlane
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PLANE_DETAIL_SECURITY_CONFIG);

// PUT /api/organizations/[organizationId]/planes/[planeId] - Update a plane
export const PUT = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, planeId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing plane update request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    planeId: params.planeId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can update planes
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to update plane',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to update planes',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(params.planeId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid ID format provided for plane update',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Get request body
  const body = await request.json();

  // Find plane by ID
  const plane = await (Plane as any).findById(params.planeId);
  if (!plane) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Plane not found for update',
      auditId: securityContext.auditId,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Plane not found',
        code: 'PLANE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Check if plane belongs to organization (still using organization_id in database for now)
  if (plane.organization_id.toString() !== params.organization) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Attempt to update plane not belonging to organization',
      auditId: securityContext.auditId,
      planeId: params.planeId,
      planeSchoolId: plane.organization_id,
      requestedOrganizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Plane not found in this organization',
        code: 'PLANE_ORGANIZATION_MISMATCH',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Validate hourlyRates if provided
  if (body.hourlyRates) {
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
  }

  // Ensure specialRates is an array if provided
  if (body.specialRates && !Array.isArray(body.specialRates)) {
    return NextResponse.json({
      error: {
        message: 'specialRates must be an array',
        code: 'INVALID_SPECIAL_RATES',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Remove _id fields from specialRates if present
  if (body.specialRates) {
    body.specialRates = body.specialRates.map((rate: any) => {
      const { _id, ...rateWithoutId } = rate;
      return rateWithoutId;
    });
  }

  // Store original values for audit logging
  const originalValues = {
    registration: plane.registration,
    status: plane.status,
    engineHours: plane.engineHours
  };

  // Update plane
  Object.assign(plane, body);
  await plane.save();

  // Transform the response to match the expected format
  const transformedPlane = {
    id: plane._id,
    registration: plane.registration,
    type: plane.type,
    model: plane.model,
    year: plane.year,
    engineHours: plane.engineHours,
    tach_time: plane.tach_time,
    hopps_time: plane.hopps_time,
    lastMaintenance: plane.lastMaintenance,
    nextMaintenance: plane.nextMaintenance,
    status: plane.status,
    hourlyRates: plane.hourlyRates,
    specialRates: plane.specialRates,
    utilization: plane.utilization,
    location: plane.location,
    notes: plane.notes
  };

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Plane updated successfully',
    auditId: securityContext.auditId,
    planeId: params.planeId,
    registration: plane.registration,
    updatedBy: securityContext.user?.id,
    changes: {
      registration: originalValues.registration !== plane.registration,
      status: originalValues.status !== plane.status,
      engineHours: originalValues.engineHours !== plane.engineHours
    },
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Plane updated successfully',
    data: {
      plane: transformedPlane
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PLANE_DETAIL_SECURITY_CONFIG);

// DELETE /api/organizations/[organizationId]/planes/[planeId] - Delete a plane
export const DELETE = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, planeId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing plane deletion request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    planeId: params.planeId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can delete planes
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to delete plane',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to delete planes',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(params.planeId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid ID format provided for plane deletion',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      planeId: params.planeId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find and delete plane (still using organization_id in database for now)
  const plane = await (Plane as any).findOneAndDelete({
    _id: params.planeId,
    organization_id: params.organization
  });

  if (!plane) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Plane not found for deletion',
      auditId: securityContext.auditId,
      planeId: params.planeId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Plane not found',
        code: 'PLANE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Plane deleted successfully',
    auditId: securityContext.auditId,
    planeId: params.planeId,
    registration: plane.registration,
    organizationId: params.organization,
    deletedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Plane deleted successfully',
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PLANE_DETAIL_SECURITY_CONFIG); 