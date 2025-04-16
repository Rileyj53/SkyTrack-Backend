import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { checkSchoolAccess } from '@/middleware/schoolAccess';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import { User } from '@/models/User';
import Plane from '@/models/Plane';

// Connect to MongoDB
connectDB();

// GET /api/schools/[schoolId]/planes/[planeId] - Get a specific plane
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string } }
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

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // If not a system admin, check school access
    if (!isSystemAdmin) {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck) {
        return schoolAccessCheck;
      }
    }

    // Validate plane ID
    if (!mongoose.Types.ObjectId.isValid(params.planeId)) {
      return NextResponse.json(
        { error: 'Invalid plane ID' },
        { status: 400 }
      );
    }

    // Find plane by ID
    const plane = await (Plane.findById(params.planeId) as any).exec();
    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found' },
        { status: 404 }
      );
    }

    // If not a system admin, verify plane belongs to the requested school
    if (!isSystemAdmin && plane.school_id.toString() !== params.schoolId) {
      return NextResponse.json(
        { error: 'Plane not found in this school' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ plane });
  } catch (error) {
    console.error('Error getting plane:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId]/planes/[planeId] - Update a plane
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string } }
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

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // If not a system admin, check school access
    if (!isSystemAdmin) {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck) {
        return schoolAccessCheck;
      }
    }

    // Check if user has admin role
    const user = await (User.findById(auth.userId) as any).exec();
    if (!user || (user.role !== 'sys_admin' && user.role !== 'school_admin')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate plane ID
    if (!mongoose.Types.ObjectId.isValid(params.planeId)) {
      return NextResponse.json(
        { error: 'Invalid plane ID' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json();

    // Find plane by ID
    const plane = await (Plane.findById(params.planeId) as any).exec();
    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found' },
        { status: 404 }
      );
    }

    // If not a system admin, verify plane belongs to the requested school
    if (!isSystemAdmin && plane.school_id.toString() !== params.schoolId) {
      return NextResponse.json(
        { error: 'Plane not found in this school' },
        { status: 404 }
      );
    }

    // If tail number is being changed, check for duplicates
    if (body.tail_number && body.tail_number.toUpperCase() !== plane.tail_number) {
      const existingPlane = await (Plane.findOne({
        school_id: plane.school_id,
        tail_number: body.tail_number.toUpperCase(),
        _id: { $ne: params.planeId }
      }) as any).exec();
      
      if (existingPlane) {
        return NextResponse.json(
          { error: 'Plane with this tail number already exists in this school' },
          { status: 400 }
        );
      }
    }

    // Update plane
    const updatedPlane = await (Plane.findByIdAndUpdate(
      params.planeId,
      { 
        $set: {
          ...body,
          tail_number: body.tail_number ? body.tail_number.toUpperCase() : plane.tail_number
        }
      },
      { new: true, runValidators: true }
    ) as any).exec();
    
    return NextResponse.json({
      message: 'Plane updated successfully',
      plane: updatedPlane
    });
  } catch (error) {
    console.error('Error updating plane:', error);
    
    // Check if it's a validation error
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/planes/[planeId] - Delete a plane
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string } }
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

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // If not a system admin, check school access
    if (!isSystemAdmin) {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck) {
        return schoolAccessCheck;
      }
    }

    // Check if user has admin role
    const user = await (User.findById(auth.userId) as any).exec();
    if (!user || (user.role !== 'sys_admin' && user.role !== 'school_admin')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate plane ID
    if (!mongoose.Types.ObjectId.isValid(params.planeId)) {
      return NextResponse.json(
        { error: 'Invalid plane ID' },
        { status: 400 }
      );
    }

    // Find and delete plane
    const plane = await (Plane.findById(params.planeId) as any).exec();
    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found' },
        { status: 404 }
      );
    }

    // If not a system admin, verify plane belongs to the requested school
    if (!isSystemAdmin && plane.school_id.toString() !== params.schoolId) {
      return NextResponse.json(
        { error: 'Plane not found in this school' },
        { status: 404 }
      );
    }

    await (Plane.findByIdAndDelete(params.planeId) as any).exec();
    
    return NextResponse.json({
      message: 'Plane deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting plane:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 