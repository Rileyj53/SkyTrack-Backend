import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { checkSchoolAccess } from '@/middleware/permissions';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import Instructor from '@/models/Instructor';

// GET handler to retrieve a specific instructor
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string; instructorId: string } }
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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.instructorId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or instructor ID' },
        { status: 400 }
      );
    }

    // Find the instructor
    const instructor = await mongoose.model('Instructor').findOne({
      _id: new mongoose.Types.ObjectId(params.instructorId),
      school_id: new mongoose.Types.ObjectId(params.schoolId)
    }).populate('user_id', 'first_name last_name email role').lean();

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(instructor);
  } catch (error) {
    console.error('Error fetching instructor:', error);
    return NextResponse.json(
      { error: 'Failed to fetch instructor' },
      { status: 500 }
    );
  }
}

// PUT handler to update an instructor
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string; instructorId: string } }
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
          { error: 'Insufficient permissions to update instructors' },
          { status: 403 }
        );
      }
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.instructorId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or instructor ID format' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Find the instructor
    const instructor = await mongoose.model('Instructor').findOne({
      _id: new mongoose.Types.ObjectId(params.instructorId),
      school_id: new mongoose.Types.ObjectId(params.schoolId)
    });

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    // If license number is being updated, check if it's already in use
    if (body.license_number && body.license_number !== instructor.license_number) {
      const existingLicense = await mongoose.model('Instructor').findOne({
        license_number: body.license_number,
        _id: { $ne: params.instructorId }
      }).exec();

      if (existingLicense) {
        return NextResponse.json(
          { error: 'License number is already in use' },
          { status: 409 }
        );
      }
    }

    // Update instructor fields
    if (body.contact_email) instructor.contact_email = body.contact_email;
    if (body.phone) instructor.phone = body.phone;
    if (body.certifications) instructor.certifications = body.certifications;
    if (body.license_number) instructor.license_number = body.license_number;
    if (body.emergency_contact) instructor.emergency_contact = body.emergency_contact;
    if (body.specialties) instructor.specialties = body.specialties;
    if (body.status) instructor.status = body.status;
    if (body.hourlyRates) instructor.hourlyRates = body.hourlyRates;
    if (body.flightHours) instructor.flightHours = body.flightHours;
    if (body.teachingHours) instructor.teachingHours = body.teachingHours;
    if (body.availability) instructor.availability = body.availability;
    if (body.students) instructor.students = body.students;
    if (body.utilization) instructor.utilization = body.utilization;
    if (body.ratings) instructor.ratings = body.ratings;
    if (body.availability_time) instructor.availability_time = body.availability_time;
    if (body.notes) instructor.notes = body.notes;
    if (body.documents) instructor.documents = body.documents;

    // Save the updated instructor
    await instructor.save();

    // Return the updated instructor
    return NextResponse.json({
      message: 'Instructor updated successfully',
      instructor,
      status: 'success'
    });
  } catch (error) {
    console.error('Error updating instructor:', error);
    return NextResponse.json(
      { error: 'Failed to update instructor' },
      { status: 500 }
    );
  }
}

// DELETE handler to delete an instructor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; instructorId: string } }
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
          { error: 'Insufficient permissions to delete instructors' },
          { status: 403 }
        );
      }
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.instructorId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or instructor ID format' },
        { status: 400 }
      );
    }

    // Find and delete the instructor
    const instructor = await mongoose.model('Instructor').findOneAndDelete({
      _id: new mongoose.Types.ObjectId(params.instructorId),
      school_id: new mongoose.Types.ObjectId(params.schoolId)
    }).exec();

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Instructor deleted successfully',
      status: 'success'
    });
  } catch (error) {
    console.error('Error deleting instructor:', error);
    return NextResponse.json(
      { error: 'Failed to delete instructor' },
      { status: 500 }
    );
  }
} 