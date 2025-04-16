import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { School, SchoolDocument } from '@/models/School';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { checkSchoolAccess } from '@/middleware/schoolAccess';
import { authenticateRequest } from '@/lib/auth';
import mongoose from 'mongoose';
import { User } from '@/models/User';

// Connect to MongoDB
connectDB();

// GET /api/schools/[schoolId] - Get a specific school
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check if the user has access to this school
    const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
    if (schoolAccessCheck) {
      return schoolAccessCheck;
    }

    // Validate school ID
    const { schoolId } = params;
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID' },
        { status: 400 }
      );
    }

    // Find school by ID
    const school = await School.findById(schoolId).select('-payment_info.stripe_customer_id');
    
    if (!school) {
      return NextResponse.json(
        { error: 'School not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      school
    });
  } catch (error) {
    console.error('Error getting school:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId] - Update a school
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check if the user has access to this school
    const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
    if (schoolAccessCheck) {
      return schoolAccessCheck;
    }

    // Get user from token
    const auth = authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    const user = await User.findById(auth.userId);
    if (!user || (user.role !== 'sys_admin' && user.role !== 'school_admin')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate school ID
    const { schoolId } = params;
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json();
    
    // Find school by ID
    const school = await School.findById(schoolId);
    
    if (!school) {
      return NextResponse.json(
        { error: 'School not found' },
        { status: 404 }
      );
    }

    // Check if name is being changed and if it already exists
    if (body.name && body.name !== school.name) {
      const existingSchool = await School.findOne({ name: body.name });
      if (existingSchool) {
        return NextResponse.json(
          { error: 'School with this name already exists' },
          { status: 400 }
        );
      }
    }

    // Update school
    const updatedSchool = await School.findByIdAndUpdate(
      schoolId,
      { $set: body },
      { new: true, runValidators: true }
    );
    
    return NextResponse.json({
      message: 'School updated successfully',
      school: updatedSchool
    });
  } catch (error) {
    console.error('Error updating school:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId] - Delete a school
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get user from token
    const auth = authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has sys_admin role
    const user = await User.findById(auth.userId);
    if (!user || user.role !== 'sys_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate school ID
    const { schoolId } = params;
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID' },
        { status: 400 }
      );
    }

    // Find and delete school
    const school = await School.findByIdAndDelete(schoolId);
    
    if (!school) {
      return NextResponse.json(
        { error: 'School not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'School deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting school:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 