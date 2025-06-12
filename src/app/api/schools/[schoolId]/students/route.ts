import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { checkSchoolAccess } from '@/middleware/permissions';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import { User } from '@/models/User';
import Student from '@/models/Student';
import Program from '@/models/Program';
import { IProgram } from '@/models/Program';

// GET handler to list all students for a specific school
export async function GET(req: NextRequest, { params }: { params: { schoolId: string } }) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(req);
    if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }

    // Authenticate request
    const authResult = await authenticateRequest(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json({ error: 'Invalid school ID' }, { status: 400 });
    }

    // Get JWT token from either Authorization header or cookie
    let token = req.headers.get('Authorization')?.split(' ')[1];
    
    // If no token in header, check cookies
    if (!token) {
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [name, value] = cookie.trim().split('=');
          acc[name] = value;
          return acc;
        }, {} as Record<string, string>);
        
        // Check common cookie names for JWT
        token = cookies['token'] || cookies['jwt'] || cookies['auth-token'];
      }
    }

    if (!token) {
      return NextResponse.json({ error: 'No token provided in Authorization header or cookies' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user has access to the school
    const hasAccess = await checkSchoolAccess(req, params.schoolId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Connect to database
    await connectDB();

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const program = searchParams.get('program') || '';
    const certification = searchParams.get('certification') || '';
    const enrollmentStartDate = searchParams.get('enrollment_start_date') || '';
    const enrollmentEndDate = searchParams.get('enrollment_end_date') || '';

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 200) {
      return NextResponse.json({ 
        error: 'Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 200' 
      }, { status: 400 });
    }

    // Build the base query
    const baseQuery: any = { 
      school_id: new mongoose.Types.ObjectId(params.schoolId) 
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
        
        // Sort by enrollment date (most recent first)
        { $sort: { enrollmentDate: -1 } },
        
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
      students = await mongoose.model('Student')
        .find(baseQuery)
        .populate('user_id', 'first_name last_name email role')
        .sort({ enrollmentDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      totalCount = await mongoose.model('Student').countDocuments(baseQuery);
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      students,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit
      }
    });
  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/students:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST handler to create a new student
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  try {
    // Validate API key
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 401 }
      );
    }

    // Validate school ID format
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID format' },
        { status: 400 }
      );
    }

    // Get JWT token from either Authorization header or cookie
    let token = request.headers.get('Authorization')?.split(' ')[1];
    
    // If no token in header, check cookies
    if (!token) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [name, value] = cookie.trim().split('=');
          acc[name] = value;
          return acc;
        }, {} as Record<string, string>);
        
        // Check common cookie names for JWT
        token = cookies['token'] || cookies['jwt'] || cookies['auth-token'];
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided in Authorization header or cookies' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
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
    if (!contact_email || !program) {
      return NextResponse.json(
        { error: 'Missing required fields: contact_email and program are required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectDB();

    // Find the program to get requirements
    const programDoc = await (Program as any).findOne({
      school_id: params.schoolId,
      program_name: program
    }).lean() as IProgram | null;

    if (!programDoc) {
      return NextResponse.json(
        { error: 'Program not found for this school' },
        { status: 404 }
      );
    }

    // Initialize progress with program requirements
    const progress = {
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

    // Create new student without studentNotes first
    const student = new Student({
      school_id: params.schoolId,
      user_id: body.user_id, // Optional field
      contact_email,
      phone,
      certifications,
      license_number,
      emergency_contact,
      enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : new Date(),
      program,
      status,
      stage: programDoc.stages?.[0]?.name, // Set initial stage if available
      nextMilestone: programDoc.milestones?.[0]?.name, // Set initial milestone if available
      notes,
      progress
    });

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

    return NextResponse.json(
      { message: 'Student created successfully', student },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 