import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { checkSchoolAccess } from '@/middleware/permissions';
import { verifyToken } from '@/lib/jwt';
import mongoose, { Error as MongooseError } from 'mongoose';
import Instructor from '@/models/Instructor';
import { User } from '@/models/User';

// GET handler to retrieve all instructors for a school
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
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

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID' },
        { status: 400 }
      );
    }

    // Find all instructors for the school
    const schoolId = new mongoose.Types.ObjectId(params.schoolId);
    // @ts-ignore - Mongoose type issue
    const instructors = await mongoose.model('Instructor').find({
      school_id: schoolId
    }).populate('user_id', 'first_name last_name email role').lean();

    return NextResponse.json(instructors);
  } catch (error: unknown) {
    console.error('Error fetching instructors:', error);
    // Check if error is a Mongoose validation error
    const mongooseError = error as MongooseError;
    if (mongooseError.name === 'ValidationError') {
      return NextResponse.json(
        { error: 'Validation error', details: (error as MongooseError.ValidationError).errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch instructors' },
      { status: 500 }
    );
  }
}

// POST handler to create a new instructor
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
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

    // Check if user has sys_admin role or is a school admin
    if (decoded.role !== 'sys_admin') {
      // For non-sys_admin users, check school access
      const hasAccess = await checkSchoolAccess(request, params.schoolId);
      
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Insufficient permissions to create instructors' },
          { status: 403 }
        );
      }
    }

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID format' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.user_id || !body.contact_email || !body.phone || !body.license_number) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, contact_email, phone, license_number' },
        { status: 400 }
      );
    }

    // Validate user_id format
    if (!mongoose.Types.ObjectId.isValid(body.user_id)) {
      return NextResponse.json(
        { error: 'Invalid user_id format' },
        { status: 400 }
      );
    }

    // Check if user exists and has instructor role
    // @ts-ignore - Mongoose type issue
    const user = await mongoose.model('User').findById(body.user_id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.role !== 'instructor') {
      return NextResponse.json(
        { error: 'User must have instructor role' },
        { status: 400 }
      );
    }

    // Check if instructor already exists for this user
    // @ts-ignore - Mongoose type issue
    const existingInstructor = await mongoose.model('Instructor').findOne({
      user_id: body.user_id,
      school_id: params.schoolId
    }).exec();

    if (existingInstructor) {
      return NextResponse.json(
        { error: 'Instructor already exists for this user in this school' },
        { status: 409 }
      );
    }

    // Check if license number is already in use
    // @ts-ignore - Mongoose type issue
    const existingLicense = await mongoose.model('Instructor').findOne({
      license_number: body.license_number
    }).exec();

    if (existingLicense) {
      return NextResponse.json(
        { error: 'License number is already in use' },
        { status: 409 }
      );
    }

    // Create new instructor
    const InstructorModel = mongoose.model('Instructor');
    const instructor = new InstructorModel({
      school_id: params.schoolId,
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

    // Return the created instructor
    return NextResponse.json({
      message: 'Instructor created successfully',
      instructor,
      status: 'success'
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating instructor:', error);
    // Check if error is a Mongoose validation error
    const mongooseError = error as MongooseError;
    if (mongooseError.name === 'ValidationError') {
      return NextResponse.json(
        { error: 'Validation error', details: (error as MongooseError.ValidationError).errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create instructor' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/instructors - Delete an instructor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if ('error' in apiKeyResult) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 });
    }

    // Authenticate user
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get instructor ID from query params
    const instructorId = request.nextUrl.searchParams.get('instructorId');
    if (!instructorId) {
      return NextResponse.json(
        { error: 'Instructor ID is required' },
        { status: 400 }
      );
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(instructorId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const role = decoded?.role;

    // Check role-based access control
    if (role !== 'sys_admin' && role !== 'school_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only system administrators and school administrators can delete instructors' },
        { status: 403 }
      );
    }

    // If not a system admin, check school access
    if (role !== 'sys_admin') {
      const hasAccess = await checkSchoolAccess(request, params.schoolId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'You do not have access to this school' },
          { status: 403 }
        );
      }
    }

    // Find and delete the instructor
    // @ts-ignore - Mongoose type issue
    const instructor = await Instructor.findOneAndDelete({
      _id: instructorId,
      school_id: params.schoolId
    });

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Instructor deleted successfully'
    });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/schools/[schoolId]/instructors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId]/instructors - Update an instructor
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if ('error' in apiKeyResult) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 });
    }

    // Authenticate user
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get instructor ID from query params
    const instructorId = request.nextUrl.searchParams.get('instructorId');
    if (!instructorId) {
      return NextResponse.json(
        { error: 'Instructor ID is required' },
        { status: 400 }
      );
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(instructorId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const role = decoded?.role;

    // Check role-based access control
    if (role === 'student') {
      return NextResponse.json(
        { error: 'Forbidden: Students cannot access this endpoint' },
        { status: 403 }
      );
    }

    // If instructor, they can only update their own data
    if (role === 'instructor') {
      if (decoded.instructor_id !== instructorId) {
        return NextResponse.json(
          { error: 'Forbidden: Instructors can only update their own data' },
          { status: 403 }
        );
      }
    } else if (role !== 'sys_admin' && role !== 'school_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // If not a system admin, check school access
    if (role !== 'sys_admin') {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck === false) {
        return NextResponse.json(
          { error: 'Access denied to this school' },
          { status: 403 }
        );
      }
      const response = schoolAccessCheck as unknown as NextResponse;
      if (response && 'status' in response) {
        return response;
      }
    }

    // Get request body
    const body = await request.json();

    // Find the instructor
    // @ts-ignore - Mongoose type issue
    const instructor = await Instructor.findOne({
      _id: instructorId,
      school_id: params.schoolId
    });

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    // If license number is being updated, check if it's already in use
    if (body.license_number && body.license_number !== instructor.license_number) {
      // @ts-ignore - Mongoose type issue
      const existingInstructor = await mongoose.model('Instructor').findOne({
        school_id: params.schoolId,
        license_number: body.license_number,
        _id: { $ne: instructorId }
      }).exec();

      if (existingInstructor) {
        return NextResponse.json(
          { error: 'License number is already in use for this school' },
          { status: 400 }
        );
      }
    }

    // Update the instructor
    // @ts-ignore - Mongoose type issue
    const updatedInstructor = await Instructor.findByIdAndUpdate(
      instructorId,
      { $set: body },
      { new: true, runValidators: true }
    );

    return NextResponse.json({
      message: 'Instructor updated successfully',
      instructor: updatedInstructor
    });
  } catch (error: unknown) {
    console.error('Error in PUT /api/schools/[schoolId]/instructors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 