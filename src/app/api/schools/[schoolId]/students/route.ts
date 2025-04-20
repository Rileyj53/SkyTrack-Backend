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

    // Get user role from token
    const token = req.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
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

    // Find all students for the school and populate user information
    const students = await mongoose.model('Student').find({ 
      school_id: new mongoose.Types.ObjectId(params.schoolId) 
    }).populate('user_id', 'first_name last_name email role').lean();

    return NextResponse.json({ students });
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

    // Validate user authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
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