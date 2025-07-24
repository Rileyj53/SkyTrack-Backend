import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import Instructor from '@/models/Instructor';
import { User } from '@/models/User';
import mongoose, { Error as MongooseError } from 'mongoose';

// Security configuration for instructor endpoints
const INSTRUCTOR_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // Required for POST/PUT/DELETE operations
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

// GET /api/organizations/[organizationId]/instructors - List all instructors for an organization
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing instructors list request',
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
  const certification = searchParams.get('certification') || '';
  const specialty = searchParams.get('specialty') || '';
  const availability = searchParams.get('availability') || '';
  const minFlightHours = searchParams.get('minFlightHours') || '';
  const maxFlightHours = searchParams.get('maxFlightHours') || '';
  const minTeachingHours = searchParams.get('minTeachingHours') || '';
  const maxTeachingHours = searchParams.get('maxTeachingHours') || '';
  const minUtilization = searchParams.get('minUtilization') || '';
  const maxUtilization = searchParams.get('maxUtilization') || '';
  const hasEmergencyContact = searchParams.get('has_emergency_contact') || '';
  const hasNotes = searchParams.get('has_notes') || '';
  const sortField = searchParams.get('sortField') || 'contact_email';
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

  // Build the base query (still using organization_id in database for now)
  const baseQuery: any = { 
    organization_id: new mongoose.Types.ObjectId(params.organization) 
  };

  // Add status filter
  if (status) {
    baseQuery.status = status;
  }

  // Add certification filter
  if (certification) {
    baseQuery.certifications = { $in: [certification] };
  }

  // Add specialty filter
  if (specialty) {
    baseQuery.specialties = { $in: [specialty] };
  }

  // Add availability filter
  if (availability) {
    baseQuery.availability = availability;
  }

  // Add flight hours range filter
  if (minFlightHours || maxFlightHours) {
    baseQuery.flightHours = {};
    if (minFlightHours) {
      baseQuery.flightHours.$gte = parseInt(minFlightHours);
    }
    if (maxFlightHours) {
      baseQuery.flightHours.$lte = parseInt(maxFlightHours);
    }
  }

  // Add teaching hours range filter
  if (minTeachingHours || maxTeachingHours) {
    baseQuery.teachingHours = {};
    if (minTeachingHours) {
      baseQuery.teachingHours.$gte = parseInt(minTeachingHours);
    }
    if (maxTeachingHours) {
      baseQuery.teachingHours.$lte = parseInt(maxTeachingHours);
    }
  }

  // Add utilization range filter
  if (minUtilization || maxUtilization) {
    baseQuery.utilization = {};
    if (minUtilization) {
      baseQuery.utilization.$gte = parseFloat(minUtilization);
    }
    if (maxUtilization) {
      baseQuery.utilization.$lte = parseFloat(maxUtilization);
    }
  }

  // Add emergency contact filter
  if (hasEmergencyContact === 'true') {
    baseQuery.emergency_contact = { $exists: true, $ne: null };
  } else if (hasEmergencyContact === 'false') {
    baseQuery.emergency_contact = { $exists: false };
  }

  // Add notes filter
  if (hasNotes === 'true') {
    baseQuery.notes = { $exists: true, $ne: null };
  } else if (hasNotes === 'false') {
    baseQuery.notes = { $exists: false };
  }

  // Calculate skip value for pagination
  const skip = (page - 1) * limit;

  let instructors;
  let totalCount;
  let searchConditions: any[] = [];

  if (search) {
    // Enhanced search functionality with better matching
    const searchTerm = search.trim();
    const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    
    // Create more sophisticated search conditions
    searchConditions = [];
    
    // Exact email match (highest priority)
    searchConditions.push({ contact_email: { $regex: `^${searchTerm}$`, $options: 'i' } });
    
    // Partial email match
    searchConditions.push({ contact_email: searchRegex });
    
    // License number search
    searchConditions.push({ license_number: searchRegex });
    
    // Phone search
    searchConditions.push({ phone: searchRegex });
    
    // Status search
    searchConditions.push({ status: searchRegex });
    
    // Availability search
    searchConditions.push({ availability: searchRegex });
    
    // Notes search (only if search term is longer than 2 characters)
    if (searchTerm.length > 2) {
      searchConditions.push({ notes: searchRegex });
    }
    
    // Certification search
    searchConditions.push({ certifications: { $in: [searchRegex] } });
    
    // Specialty search
    searchConditions.push({ specialties: { $in: [searchRegex] } });
    
    // Numeric search for hours
    if (/^\d+$/.test(searchTerm)) {
      const hours = parseInt(searchTerm);
      searchConditions.push({ 
        $or: [
          { flightHours: hours },
          { teachingHours: hours },
          { students: hours }
        ]
      });
    }
    
    // User information search (name, email)
    searchConditions.push({
      $expr: {
        $or: [
          {
            $regexMatch: {
              input: { $ifNull: ['$user_info.first_name', ''] },
              regex: searchTerm,
              options: 'i'
            }
          },
          {
            $regexMatch: {
              input: { $ifNull: ['$user_info.last_name', ''] },
              regex: searchTerm,
              options: 'i'
            }
          },
          {
            $regexMatch: {
              input: { $ifNull: ['$user_info.email', ''] },
              regex: searchTerm,
              options: 'i'
            }
          },
          // Search for concatenated full name
          {
            $regexMatch: {
              input: {
                $concat: [
                  { $ifNull: ['$user_info.first_name', ''] },
                  ' ',
                  { $ifNull: ['$user_info.last_name', ''] }
                ]
              },
              regex: searchTerm,
              options: 'i'
            }
          }
        ]
      }
    });
    
    const pipeline: any[] = [
      // Match the base query first
      { $match: baseQuery },
      
      // Lookup user information
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user_info'
        }
      },
      
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
              // Exact email match gets highest score
              { $cond: [{ $regexMatch: { input: '$contact_email', regex: `^${searchTerm}$`, options: 'i' } }, 100, 0] },
              // Email starts with search term
              { $cond: [{ $regexMatch: { input: '$contact_email', regex: `^${searchTerm}`, options: 'i' } }, 50, 0] },
              // Email contains search term
              { $cond: [{ $regexMatch: { input: '$contact_email', regex: searchTerm, options: 'i' } }, 25, 0] },
              // License number match
              { $cond: [{ $regexMatch: { input: '$license_number', regex: searchTerm, options: 'i' } }, 20, 0] },
              // First name match
              { $cond: [{ $regexMatch: { input: { $ifNull: ['$user_info.first_name', ''] }, regex: searchTerm, options: 'i' } }, 15, 0] },
              // Last name match
              { $cond: [{ $regexMatch: { input: { $ifNull: ['$user_info.last_name', ''] }, regex: searchTerm, options: 'i' } }, 15, 0] },
              // Status match
              { $cond: [{ $regexMatch: { input: '$status', regex: searchTerm, options: 'i' } }, 10, 0] },
              // Availability match
              { $cond: [{ $regexMatch: { input: '$availability', regex: searchTerm, options: 'i' } }, 5, 0] }
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
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user_info'
        }
      },
      {
        $match: {
          $or: searchConditions
        }
      },
      { $count: 'total' }
    ];

    instructors = await mongoose.model('Instructor').aggregate(pipeline);
    const countResult = await mongoose.model('Instructor').aggregate(countPipeline);
    totalCount = countResult.length > 0 ? countResult[0].total : 0;
  } else {
    // If no search, use regular find with populate
    const sortObject: any = {};
    sortObject[sortField] = sortDirection === 'asc' ? 1 : -1;
    
    instructors = await (mongoose.model('Instructor') as any)
      .find(baseQuery)
      .populate('user_id', 'first_name last_name email role')
      .sort(sortObject)
      .skip(skip)
      .limit(limit)
      .lean();

    totalCount = await (mongoose.model('Instructor') as any).countDocuments(baseQuery);
  }

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  // Get unique values for filters
  const allInstructors = await (mongoose.model('Instructor') as any).find({ 
    organization_id: new mongoose.Types.ObjectId(params.organization) 
  }).lean();
  
  const uniqueStatuses = Array.from(new Set(allInstructors.map(instructor => instructor.status).filter(Boolean))).sort();
  const uniqueCertifications = Array.from(new Set(allInstructors.flatMap(instructor => instructor.certifications || []).filter(Boolean))).sort();
  const uniqueSpecialties = Array.from(new Set(allInstructors.flatMap(instructor => instructor.specialties || []).filter(Boolean))).sort();
  const uniqueAvailabilities = Array.from(new Set(allInstructors.map(instructor => instructor.availability).filter(Boolean))).sort();

  // Generate search suggestions if search term is provided
  let searchSuggestions = null;
  if (search && search.trim().length > 0) {
    const searchTerm = search.trim().toLowerCase();
    const suggestions = new Set<string>();
    
    // Add matching emails
    allInstructors.forEach(instructor => {
      if (instructor.contact_email && instructor.contact_email.toLowerCase().includes(searchTerm)) {
        suggestions.add(instructor.contact_email);
      }
    });
    
    // Add matching license numbers
    allInstructors.forEach(instructor => {
      if (instructor.license_number && instructor.license_number.toLowerCase().includes(searchTerm)) {
        suggestions.add(instructor.license_number);
      }
    });
    
    // Add matching statuses
    allInstructors.forEach(instructor => {
      if (instructor.status && instructor.status.toLowerCase().includes(searchTerm)) {
        suggestions.add(instructor.status);
      }
    });
    
    // Add matching certifications
    allInstructors.forEach(instructor => {
      if (instructor.certifications) {
        instructor.certifications.forEach((cert: string) => {
          if (cert.toLowerCase().includes(searchTerm)) {
            suggestions.add(cert);
          }
        });
      }
    });
    
    // Add matching specialties
    allInstructors.forEach(instructor => {
      if (instructor.specialties) {
        instructor.specialties.forEach((spec: string) => {
          if (spec.toLowerCase().includes(searchTerm)) {
            suggestions.add(spec);
          }
        });
      }
    });
    
    searchSuggestions = Array.from(suggestions).slice(0, 10); // Limit to 10 suggestions
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Instructors list request completed successfully',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    instructorsCount: instructors.length,
    totalCount,
    searchTerm: search || null,
    searchConditions: search ? searchConditions?.length || 0 : null,
    uniqueStatusesCount: uniqueStatuses.length,
    uniqueCertificationsCount: uniqueCertifications.length,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Instructors retrieved successfully',
    data: {
      instructors,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit,
        uniqueStatuses,
        uniqueCertifications,
        uniqueSpecialties,
        uniqueAvailabilities,
        searchSuggestions: searchSuggestions || null
      }
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, INSTRUCTOR_SECURITY_CONFIG);

// POST /api/organizations/[organizationId]/instructors - Create a new instructor
export const POST = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing instructor creation request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can create instructors
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to create instructor',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to create instructors',
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
      message: 'Invalid organization ID format provided for instructor creation',
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

  // Parse request body
  const body = await request.json();

  // Validate required fields
  const requiredFields = ['user_id', 'contact_email', 'phone', 'license_number'];
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

  // Validate user_id format
  if (!mongoose.Types.ObjectId.isValid(body.user_id)) {
    return NextResponse.json({
      error: {
        message: 'Invalid user_id format',
        code: 'INVALID_USER_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Check if user exists and has instructor role
  const user = await (mongoose.model('User') as any).findById(body.user_id);
  if (!user) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'User not found for instructor creation',
      auditId: securityContext.auditId,
      userId: body.user_id,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'User not found',
        code: 'USER_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  if (user.role !== 'instructor') {
    return NextResponse.json({
      error: {
        message: 'User must have instructor role',
        code: 'INVALID_USER_ROLE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Check if instructor already exists for this user (still using organization_id in database for now)
  const existingInstructor = await (mongoose.model('Instructor') as any).findOne({
    user_id: body.user_id,
    organization_id: params.organization
  }).exec();

  if (existingInstructor) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Instructor already exists for user in organization',
      auditId: securityContext.auditId,
      userId: body.user_id,
      organizationId: params.organization,
      existingInstructorId: existingInstructor._id,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Instructor already exists for this user in this organization',
        code: 'INSTRUCTOR_EXISTS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 409 });
  }

  // Check if license number is already in use
  const existingLicense = await (mongoose.model('Instructor') as any).findOne({
    license_number: body.license_number
  }).exec();

  if (existingLicense) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'License number already in use',
      auditId: securityContext.auditId,
      licenseNumber: body.license_number,
      existingInstructorId: existingLicense._id,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'License number is already in use',
        code: 'LICENSE_EXISTS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 409 });
  }

  // Create new instructor (still using organization_id in database for now)
  const InstructorModel = mongoose.model('Instructor');
  const instructor = new InstructorModel({
    organization_id: params.organization,
    user_id: body.user_id,
    contact_email: body.contact_email,
    phone: body.phone,
    certifications: body.certifications || [],
    license_number: body.license_number,
    emergency_contact: body.emergency_contact || {
      name: '',
      relationship: '',
      phone: ''
    },
    specialties: body.specialties || [],
    status: body.status || 'Active',
    hourlyRates: body.hourlyRates || {
      primary: 0,
      instrument: 0,
      advanced: 0,
      multiEngine: 0
    },
    flightHours: body.flightHours || 0,
    teachingHours: body.teachingHours || 0,
    availability: body.availability || 'Full-time',
    students: body.students || 0,
    utilization: body.utilization || 0,
    ratings: body.ratings || [],
    availability_time: body.availability_time || {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: []
    },
    notes: body.notes || '',
    documents: body.documents || []
  });

  // Save the instructor
  await instructor.save();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Instructor created successfully',
    auditId: securityContext.auditId,
    instructorId: instructor._id,
    userId: body.user_id,
    organizationId: params.organization,
    createdBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  // Return the created instructor
  return NextResponse.json({
    success: true,
    message: 'Instructor created successfully',
    data: {
      instructor
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }, { status: 201 });
}, INSTRUCTOR_SECURITY_CONFIG);

// DELETE /api/organizations/[organizationId]/instructors - Delete an instructor
export const DELETE = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing instructor deletion request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can delete instructors
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to delete instructor',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to delete instructors',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Get instructor ID from query params
  const instructorId = request.nextUrl.searchParams.get('instructorId');
  if (!instructorId) {
    return NextResponse.json({
      error: {
        message: 'Instructor ID is required',
        code: 'MISSING_INSTRUCTOR_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(instructorId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid ID format provided for instructor deletion',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      instructorId: instructorId,
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

  // Find and delete the instructor (still using organization_id in database for now)
  const instructor = await (Instructor as any).findOneAndDelete({
    _id: instructorId,
    organization_id: params.organization
  });

  if (!instructor) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Instructor not found for deletion',
      auditId: securityContext.auditId,
      instructorId: instructorId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Instructor not found',
        code: 'INSTRUCTOR_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Instructor deleted successfully',
    auditId: securityContext.auditId,
    instructorId: instructorId,
    organizationId: params.organization,
    deletedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Instructor deleted successfully',
    data: {
      instructor_id: instructorId
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, INSTRUCTOR_SECURITY_CONFIG);

// PUT /api/organizations/[organizationId]/instructors - Update an instructor
export const PUT = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing instructor update request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Get instructor ID from query params
  const instructorId = request.nextUrl.searchParams.get('instructorId');
  if (!instructorId) {
    return NextResponse.json({
      error: {
        message: 'Instructor ID is required',
        code: 'MISSING_INSTRUCTOR_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || !mongoose.Types.ObjectId.isValid(instructorId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid ID format provided for instructor update',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      instructorId: instructorId,
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

  // Role-based access control
  const userRole = securityContext.user?.role;
  const userId = securityContext.user?.id;

  // Students cannot access this endpoint
  if (userRole === 'student') {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Student attempted to access instructor update endpoint',
      auditId: securityContext.auditId,
      userId: userId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Students cannot access this endpoint',
        code: 'FORBIDDEN_ROLE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // If instructor, they can only update their own data
  if (userRole === 'instructor') {
    // Find the instructor record to get the user_id (still using organization_id in database for now)
    const instructorRecord = await (Instructor as any).findOne({
      _id: instructorId,
      organization_id: params.organization
    }).populate('user_id', '_id').lean();

    if (!instructorRecord) {
      return NextResponse.json({
        error: {
          message: 'Instructor not found',
          code: 'INSTRUCTOR_NOT_FOUND',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    const instructorUserId = instructorRecord.user_id?._id?.toString() || instructorRecord.user_id?.toString();
    if (instructorUserId !== userId) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Instructor attempted to update another instructor\'s data',
        auditId: securityContext.auditId,
        userId: userId,
        instructorId: instructorId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Instructors can only update their own data',
          code: 'FORBIDDEN_ACCESS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 403 });
    }
  }

  // Get request body
  const body = await request.json();

  // Find the instructor (still using organization_id in database for now)
  const instructor = await (Instructor as any).findOne({
    _id: instructorId,
    organization_id: params.organization
  });

  if (!instructor) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Instructor not found for update',
      auditId: securityContext.auditId,
      instructorId: instructorId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Instructor not found',
        code: 'INSTRUCTOR_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // If license number is being updated, check if it's already in use
  if (body.license_number && body.license_number !== instructor.license_number) {
    const existingInstructor = await (mongoose.model('Instructor') as any).findOne({
      organization_id: params.organization,
      license_number: body.license_number,
      _id: { $ne: instructorId }
    }).exec();

    if (existingInstructor) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'License number already in use during update',
        auditId: securityContext.auditId,
        licenseNumber: body.license_number,
        instructorId: instructorId,
        existingInstructorId: existingInstructor._id,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'License number is already in use for this organization',
          code: 'LICENSE_EXISTS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
  }

  // Update the instructor
  const updatedInstructor = await (Instructor as any).findByIdAndUpdate(
    instructorId,
    { $set: body },
    { new: true, runValidators: true }
  );

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Instructor updated successfully',
    auditId: securityContext.auditId,
    instructorId: instructorId,
    updatedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Instructor updated successfully',
    data: {
      instructor: updatedInstructor
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, INSTRUCTOR_SECURITY_CONFIG); 