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

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const type = searchParams.get('type') || '';
  const aircraftModel = searchParams.get('aircraftModel') || '';
  const location = searchParams.get('location') || '';
  const year = searchParams.get('year') || '';
  const minEngineHours = searchParams.get('minEngineHours') || '';
  const maxEngineHours = searchParams.get('maxEngineHours') || '';
  const hasNotes = searchParams.get('has_notes') || '';
  const sortField = searchParams.get('sortField') || 'registration';
  const sortDirection = searchParams.get('sortDirection') || 'asc';

  // Validate pagination parameters
  if (page < 1 || limit < 1 || limit > 200) {
    return NextResponse.json({
      error: {
        message: 'Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 200',
        code: 'INVALID_PAGINATION',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Build the base query
  const baseQuery: any = { organization_id: params.organization };

  // Add status filter
  if (status) {
    baseQuery.status = status;
  }

  // Add type filter
  if (type) {
    baseQuery.type = { $regex: type, $options: 'i' };
  }

  // Add aircraft model filter
  if (aircraftModel) {
    baseQuery.aircraftModel = { $regex: aircraftModel, $options: 'i' };
  }

  // Add location filter
  if (location) {
    baseQuery.location = { $regex: location, $options: 'i' };
  }

  // Add year filter
  if (year) {
    baseQuery.year = parseInt(year);
  }

  // Add engine hours range filter
  if (minEngineHours || maxEngineHours) {
    baseQuery.engineHours = {};
    if (minEngineHours) {
      baseQuery.engineHours.$gte = parseInt(minEngineHours);
    }
    if (maxEngineHours) {
      baseQuery.engineHours.$lte = parseInt(maxEngineHours);
    }
  }

  // Add notes filter
  if (hasNotes === 'true') {
    baseQuery.notes = { $exists: true, $ne: null };
  } else if (hasNotes === 'false') {
    baseQuery.notes = { $exists: false };
  }

  // Calculate skip value for pagination
  const skip = (page - 1) * limit;

  let planes;
  let totalCount;
  let searchConditions: any[] = [];

  if (search) {
    // Enhanced search functionality with better matching
    const searchTerm = search.trim();
    const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    
    // Create more sophisticated search conditions
    searchConditions = [];
    
    // Exact registration match (highest priority)
    searchConditions.push({ registration: { $regex: `^${searchTerm}$`, $options: 'i' } });
    
    // Partial registration match
    searchConditions.push({ registration: searchRegex });
    
    // Aircraft model search
    searchConditions.push({ aircraftModel: searchRegex });
    
    // Type search
    searchConditions.push({ type: searchRegex });
    
    // Location search
    searchConditions.push({ location: searchRegex });
    
    // Status search
    searchConditions.push({ status: searchRegex });
    
    // Notes search (only if search term is longer than 2 characters)
    if (searchTerm.length > 2) {
      searchConditions.push({ notes: searchRegex });
    }
    
    // Year search (if search term looks like a year)
    if (/^\d{4}$/.test(searchTerm)) {
      searchConditions.push({ year: parseInt(searchTerm) });
    }
    
    // Engine hours search (if search term looks like a number)
    if (/^\d+$/.test(searchTerm)) {
      const hours = parseInt(searchTerm);
      searchConditions.push({ 
        $or: [
          { engineHours: hours },
          { total_hours: hours },
          { tach_time: hours },
          { hopps_time: hours }
        ]
      });
    }
    
    const pipeline: any[] = [
      // Match the base query first
      { $match: baseQuery },
      
      // Add enhanced search conditions
      {
        $match: {
          $or: searchConditions
        }
      },
      
      // Add a score field for better ranking
      {
        $addFields: {
          searchScore: {
            $sum: [
              // Exact registration match gets highest score
              { $cond: [{ $regexMatch: { input: '$registration', regex: `^${searchTerm}$`, options: 'i' } }, 100, 0] },
              // Registration starts with search term
              { $cond: [{ $regexMatch: { input: '$registration', regex: `^${searchTerm}`, options: 'i' } }, 50, 0] },
              // Registration contains search term
              { $cond: [{ $regexMatch: { input: '$registration', regex: searchTerm, options: 'i' } }, 25, 0] },
              // Aircraft model match
              { $cond: [{ $regexMatch: { input: '$aircraftModel', regex: searchTerm, options: 'i' } }, 20, 0] },
              // Type match
              { $cond: [{ $regexMatch: { input: '$type', regex: searchTerm, options: 'i' } }, 15, 0] },
              // Location match
              { $cond: [{ $regexMatch: { input: '$location', regex: searchTerm, options: 'i' } }, 10, 0] },
              // Status match
              { $cond: [{ $regexMatch: { input: '$status', regex: searchTerm, options: 'i' } }, 5, 0] }
            ]
          }
        }
      },
      
      // Sort by search score first (descending), then by specified field
      { 
        $sort: { 
          searchScore: -1,
          [sortField]: sortDirection === 'asc' ? 1 : -1 
        } 
      },
      
      // Remove the search score field from results
      {
        $project: {
          searchScore: 0
        }
      },
      
      // Add pagination
      { $skip: skip },
      { $limit: limit }
    ];

    // Get total count for pagination info
    const countPipeline: any[] = [
      { $match: baseQuery },
      {
        $match: {
          $or: searchConditions
        }
      },
      { $count: 'total' }
    ];

    planes = await mongoose.model('Plane').aggregate(pipeline);
    const countResult = await mongoose.model('Plane').aggregate(countPipeline);
    totalCount = countResult.length > 0 ? countResult[0].total : 0;
  } else {
    // If no search, use regular find with sorting and pagination
    const sortObject: any = {};
    sortObject[sortField] = sortDirection === 'asc' ? 1 : -1;
    
    planes = await (Plane as any)
      .find(baseQuery)
      .sort(sortObject)
      .skip(skip)
      .limit(limit)
      .lean();

    totalCount = await (Plane as any).countDocuments(baseQuery);
  }
  
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

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  // Get unique locations and types for all planes in the organization
  const allPlanes = await (Plane as any).find({ organization_id: params.organization }).lean();
  const uniqueLocations = Array.from(new Set(allPlanes.map(plane => plane.location).filter(Boolean))).sort();
  const uniqueTypes = Array.from(new Set(allPlanes.map(plane => plane.type).filter(Boolean))).sort();

  // Generate search suggestions if search term is provided
  let searchSuggestions = null;
  if (search && search.trim().length > 0) {
    const searchTerm = search.trim().toLowerCase();
    const suggestions = new Set<string>();
    
    // Add matching registrations
    allPlanes.forEach(plane => {
      if (plane.registration && plane.registration.toLowerCase().includes(searchTerm)) {
        suggestions.add(plane.registration);
      }
    });
    
    // Add matching aircraft models
    allPlanes.forEach(plane => {
      if (plane.aircraftModel && plane.aircraftModel.toLowerCase().includes(searchTerm)) {
        suggestions.add(plane.aircraftModel);
      }
    });
    
    // Add matching types
    allPlanes.forEach(plane => {
      if (plane.type && plane.type.toLowerCase().includes(searchTerm)) {
        suggestions.add(plane.type);
      }
    });
    
    // Add matching locations
    allPlanes.forEach(plane => {
      if (plane.location && plane.location.toLowerCase().includes(searchTerm)) {
        suggestions.add(plane.location);
      }
    });
    
    searchSuggestions = Array.from(suggestions).slice(0, 10); // Limit to 10 suggestions
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Planes list request completed successfully',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    planesCount: transformedPlanes.length,
    totalCount,
    searchTerm: search || null,
    searchConditions: search ? searchConditions?.length || 0 : null,
    uniqueLocationsCount: uniqueLocations.length,
    uniqueTypesCount: uniqueTypes.length,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));
  
  return NextResponse.json({
    success: true,
    message: 'Planes retrieved successfully',
    data: {
      planes: transformedPlanes,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit,
        uniqueLocations,
        uniqueTypes
      },
      searchSuggestions: searchSuggestions || null
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
    'hourlyRates',
    'last_maintenance',
    'next_maintenance'
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