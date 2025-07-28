import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import { User } from '@/models/User';
import Student from '@/models/Student';
import Program from '@/models/Program';
import { IProgram } from '@/models/Program';

// Security configuration for students endpoints
const STUDENTS_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: false, // GET operations don't need CSRF
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin', 'instructor'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000,
    slidingWindow: true
  }
};

const STUDENTS_CREATE_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // POST operations need CSRF
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 50,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET handler to list all students for a specific organization
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing students list request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate organization ID
  if (!mongoose.Types.ObjectId.isValid(params.organization)) {
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
  const program = searchParams.get('program') || '';
  const certification = searchParams.get('certification') || '';
  const enrollmentStartDate = searchParams.get('enrollment_start_date') || '';
  const enrollmentEndDate = searchParams.get('enrollment_end_date') || '';
  const stage = searchParams.get('stage') || '';
  const milestone = searchParams.get('milestone') || '';
  const licenseNumber = searchParams.get('license_number') || '';
  const phone = searchParams.get('phone') || '';
  const sortField = searchParams.get('sortField') || 'enrollmentDate';
  const sortDirection = searchParams.get('sortDirection') || 'desc';
  const hasEmergencyContact = searchParams.get('has_emergency_contact') || '';
  const hasNotes = searchParams.get('has_notes') || '';

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

  // Add program filter
  if (program) {
    baseQuery.program = { $regex: program, $options: 'i' };
  }

  // Add certification filter
  if (certification) {
    baseQuery.certifications = { $in: [certification] };
  }

  // Add enrollment date range filter
  if (enrollmentStartDate || enrollmentEndDate) {
    baseQuery.enrollmentDate = {};
    if (enrollmentStartDate) {
      baseQuery.enrollmentDate.$gte = new Date(enrollmentStartDate);
    }
    if (enrollmentEndDate) {
      baseQuery.enrollmentDate.$lte = new Date(enrollmentEndDate);
    }
  }

  // Add stage filter
  if (stage) {
    baseQuery.stage = { $regex: stage, $options: 'i' };
  }

  // Add milestone filter
  if (milestone) {
    baseQuery.nextMilestone = { $regex: milestone, $options: 'i' };
  }

  // Add license number filter
  if (licenseNumber) {
    baseQuery.license_number = { $regex: licenseNumber, $options: 'i' };
  }

  // Add phone filter
  if (phone) {
    baseQuery.phone = { $regex: phone, $options: 'i' };
  }

  // Add emergency contact filter
  if (hasEmergencyContact === 'true') {
    baseQuery.emergency_contact = { $exists: true, $ne: null };
  } else if (hasEmergencyContact === 'false') {
    baseQuery.emergency_contact = { $exists: false };
  }

  // Add notes filter (simplified)
  if (hasNotes === 'true') {
    baseQuery.notes = { $exists: true, $ne: null };
  } else if (hasNotes === 'false') {
    baseQuery.notes = { $exists: false };
  }

  // Calculate skip value for pagination
  const skip = (page - 1) * limit;

  let students;
  let totalCount;

  if (search) {
    // If search is provided, use aggregation pipeline for complex search
    const searchRegex = new RegExp(search, 'i');
    
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
      
      // Add search conditions
      {
        $match: {
          $or: [
            { 'user_info.first_name': searchRegex },
            { 'user_info.last_name': searchRegex },
            { 'user_info.email': searchRegex },
            { contact_email: searchRegex },
            { phone: searchRegex },
            { license_number: searchRegex },
            { program: searchRegex },
            { status: searchRegex },
            { stage: searchRegex },
            { nextMilestone: searchRegex },
            { notes: searchRegex },
            { 'emergency_contact.name': searchRegex },
            { 'emergency_contact.phone': searchRegex },
            // Search for concatenated full name
            {
              $expr: {
                $regexMatch: {
                  input: {
                    $concat: [
                      { $ifNull: [{ $arrayElemAt: ['$user_info.first_name', 0] }, ''] },
                      ' ',
                      { $ifNull: [{ $arrayElemAt: ['$user_info.last_name', 0] }, ''] }
                    ]
                  },
                  regex: search,
                  options: 'i'
                }
              }
            }
          ]
        }
      },
      
      // Add user info to the root level for easier access
      {
        $addFields: {
          user_id: { $arrayElemAt: ['$user_info', 0] }
        }
      },
      
      // Remove the temporary user_info array
      {
        $unset: 'user_info'
      },
      
      // Sort by specified field and direction
      { $sort: { [sortField]: sortDirection === 'asc' ? 1 : -1 } },
      
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
          $or: [
            { 'user_info.first_name': searchRegex },
            { 'user_info.last_name': searchRegex },
            { 'user_info.email': searchRegex },
            { contact_email: searchRegex },
            { phone: searchRegex },
            { license_number: searchRegex },
            { program: searchRegex },
            { status: searchRegex },
            { stage: searchRegex },
            { nextMilestone: searchRegex },
            { notes: searchRegex },
            { 'emergency_contact.name': searchRegex },
            { 'emergency_contact.phone': searchRegex },
            {
              $expr: {
                $regexMatch: {
                  input: {
                    $concat: [
                      { $ifNull: [{ $arrayElemAt: ['$user_info.first_name', 0] }, ''] },
                      ' ',
                      { $ifNull: [{ $arrayElemAt: ['$user_info.last_name', 0] }, ''] }
                    ]
                  },
                  regex: search,
                  options: 'i'
                }
              }
            }
          ]
        }
      },
      { $count: 'total' }
    ];

    students = await mongoose.model('Student').aggregate(pipeline);
    const countResult = await mongoose.model('Student').aggregate(countPipeline);
    totalCount = countResult.length > 0 ? countResult[0].total : 0;
  } else {
    // If no search, use regular find with populate
    const sortObject: any = {};
    sortObject[sortField] = sortDirection === 'asc' ? 1 : -1;
    
    students = await mongoose.model('Student')
      .find(baseQuery)
      .populate('user_id', 'first_name last_name email role')
      .sort(sortObject)
      .skip(skip)
      .limit(limit)
      .lean();

    totalCount = await mongoose.model('Student').countDocuments(baseQuery);
  }

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Students list request completed successfully',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    studentsCount: students.length,
    totalCount,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Students retrieved successfully',
    data: {
      students,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit
      }
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, STUDENTS_SECURITY_CONFIG);

// POST handler to create a new student
export const POST = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing student creation request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate organization ID format
  if (!mongoose.Types.ObjectId.isValid(params.organization)) {
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
  const {
    contact_email,
    phone,
    certifications = [],
    license_number,
    emergency_contact,
    enrollmentDate,
    program,
    status = 'Active',
    stage,
    nextMilestone,
    notes,
    studentNotes = []
  } = body;

  // Validate required fields
  if (!contact_email) {
    return NextResponse.json({
      error: {
        message: 'Missing required field: contact_email is required',
        code: 'MISSING_REQUIRED_FIELDS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(contact_email)) {
    return NextResponse.json({
      error: {
        message: 'Invalid email format',
        code: 'INVALID_EMAIL_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Check if student with this email already exists in this organization (still using organization_id in database for now)
  const existingStudent = await (Student as any).findOne({
    organization_id: params.organization,
    contact_email: contact_email.toLowerCase()
  });

  if (existingStudent) {
    return NextResponse.json({
      error: {
        message: 'A student with this email already exists in this organization',
        code: 'DUPLICATE_STUDENT_EMAIL',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 409 });
  }

  // Initialize progress and program validation
  let progress = null;
  let initialStage = undefined;
  let initialMilestone = undefined;

  // If program is provided, validate it and initialize progress
  if (program) {
    // Find the program to get requirements (still using organization_id in database for now)
    const programDoc = await (Program as any).findOne({
      organization_id: params.organization,
      program_name: program
    }).lean() as IProgram | null;

    if (!programDoc) {
      return NextResponse.json({
        error: {
          message: 'Program not found for this organization',
          code: 'PROGRAM_NOT_FOUND',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    // Initialize progress with program requirements
    progress = {
      requirements: programDoc.requirements.map(req => ({
        name: req.name,
        total_hours: req.hours,
        completed_hours: 0,
        type: req.type
      })),
      milestones: programDoc.milestones.map(milestone => ({
        name: milestone.name,
        description: milestone.description,
        order: milestone.order,
        completed: false
      })),
      stages: programDoc.stages.map(stage => ({
        name: stage.name,
        description: stage.description,
        order: stage.order,
        completed: false
      })),
      lastUpdated: new Date()
    };

    // Set initial stage and milestone if available
    initialStage = programDoc.stages?.[0]?.name;
    initialMilestone = programDoc.milestones?.[0]?.name;
  }

  // Create new student without studentNotes first (still using organization_id in database for now)
  const studentData: any = {
    organization_id: params.organization,
    user_id: body.user_id, // Optional field
    contact_email: contact_email.toLowerCase(),
    phone,
    certifications,
    license_number,
    emergency_contact,
    enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : new Date(),
    status,
    stage: initialStage, // Set initial stage if available
    nextMilestone: initialMilestone, // Set initial milestone if available
    notes,
    progress
  };

  // Only add program if it has a value
  if (program) {
    studentData.program = program;
  }

  const student = new Student(studentData);

  // Save the student first to get the ID
  await student.save();

  // If there are student notes, add them after the student is created
  if (studentNotes && studentNotes.length > 0) {
    // Add the student_id to each note
    const notesWithStudentId = studentNotes.map(note => ({
      ...note,
      student_id: student._id,
      created_at: new Date(),
      updated_at: new Date()
    }));

    // Update the student with the notes
    student.studentNotes = notesWithStudentId;
    await student.save();
  }

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Student created successfully',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    studentId: student._id,
    hasProgram: !!program,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: program ? 'Student created successfully' : 'Member created successfully',
    data: { student },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }, { status: 201 });
}, STUDENTS_CREATE_SECURITY_CONFIG); 