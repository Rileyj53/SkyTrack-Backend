import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { checkSchoolAccess } from '@/middleware/permissions';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import Student from '@/models/Student';

// DELETE handler to delete a student
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; studentId: string } }
) {
  try {
    await connectDB();

    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Check if user has sys_admin role or is a school admin/instructor
    if (decoded.role !== 'sys_admin') {
      // For non-sys_admin users, check school access
      const hasAccess = await checkSchoolAccess(request, params.schoolId);
      
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Insufficient permissions to delete students' },
          { status: 403 }
        );
      }
    }

    // Validate school ID and student ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.studentId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or student ID format' },
        { status: 400 }
      );
    }

    // Find and delete the student
    const student = await mongoose.model('Student').findOne({
      _id: new mongoose.Types.ObjectId(params.studentId),
      school_id: new mongoose.Types.ObjectId(params.schoolId)
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    await student.deleteOne();

    return NextResponse.json({
      message: 'Student deleted successfully',
      status: 'success'
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT handler to update a student
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string; studentId: string } }
) {
  try {
    await connectDB();

    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Validate school ID and student ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.studentId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or student ID format' },
        { status: 400 }
      );
    }

    // Check role-based access control
    if (decoded.role === 'student') {
      // Students can only update their own records
      const student = await mongoose.model('Student').findOne({
        _id: new mongoose.Types.ObjectId(params.studentId),
        user_id: decoded.userId
      });

      if (!student) {
        return NextResponse.json(
          { error: 'You can only update your own student record' },
          { status: 403 }
        );
      }
    } else if (decoded.role !== 'sys_admin') {
      // For non-sys_admin users, check school access
      const hasAccess = await checkSchoolAccess(request, params.schoolId);
      
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Insufficient permissions to update students' },
          { status: 403 }
        );
      }
    }

    // Parse request body
    const body = await request.json();

    // Find the student
    const student = await mongoose.model('Student').findOne({
      _id: new mongoose.Types.ObjectId(params.studentId),
      school_id: new mongoose.Types.ObjectId(params.schoolId)
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Update student fields
    if (body.contact_email) student.contact_email = body.contact_email;
    if (body.phone) student.phone = body.phone;
    if (body.certifications) student.certifications = body.certifications;
    if (body.license_number) student.license_number = body.license_number;
    if (body.emergency_contact) student.emergency_contact = body.emergency_contact;
    if (body.enrollmentDate) student.enrollmentDate = new Date(body.enrollmentDate);
    if (body.program) student.program = body.program;
    if (body.status) student.status = body.status;
    if (body.stage) student.stage = body.stage;
    if (body.nextMilestone) student.nextMilestone = body.nextMilestone;
    if (body.notes) student.notes = body.notes;
    if (body.progress) student.progress = body.progress;
    
    // Handle studentNotes separately to remove temporary IDs
    if (body.studentNotes) {
      student.studentNotes = body.studentNotes.map(note => {
        // Remove temporary IDs (those that don't match MongoDB ObjectId format)
        const { _id, ...noteWithoutId } = note;
        // Only include _id if it's a valid MongoDB ObjectId
        if (_id && /^[0-9a-fA-F]{24}$/.test(_id)) {
          return { ...noteWithoutId, _id };
        }
        return noteWithoutId;
      });
    }

    // Save the updated student
    await student.save();

    return NextResponse.json({
      message: 'Student updated successfully',
      student: student.toObject(),
      status: 'success'
    });
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string; studentId: string } }
) {
  try {
    await connectDB();

    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check if user has access to this school
    const hasAccess = await checkSchoolAccess(request, params.schoolId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this school' },
        { status: 403 }
      );
    }

    // Validate student ID
    if (!mongoose.Types.ObjectId.isValid(params.studentId)) {
      return NextResponse.json(
        { error: 'Invalid student ID' },
        { status: 400 }
      );
    }

    // Find the student
    const student = await mongoose.model('Student').findOne({
      _id: new mongoose.Types.ObjectId(params.studentId),
      school_id: new mongoose.Types.ObjectId(params.schoolId)
    }).populate('user_id', 'first_name last_name email role').lean();

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json(
      { error: 'Failed to fetch student' },
      { status: 500 }
    );
  }
} 