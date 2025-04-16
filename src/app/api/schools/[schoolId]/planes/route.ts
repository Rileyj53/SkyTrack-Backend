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

// GET /api/schools/[schoolId]/planes - List all planes for a school
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

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID' },
        { status: 400 }
      );
    }

    // If not a system admin, check school access
    if (!isSystemAdmin) {
      const schoolAccessCheck = await checkSchoolAccess(request, params.schoolId);
      if (schoolAccessCheck) {
        return schoolAccessCheck;
      }
    }

    // Find all planes for this school
    const planes = await (Plane.find({ school_id: params.schoolId }) as any).exec();
    
    return NextResponse.json({
      planes
    });
  } catch (error) {
    console.error('Error listing planes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/schools/[schoolId]/planes - Create a new plane for a school
export async function POST(
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

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID' },
        { status: 400 }
      );
    }

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

    // Get request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.tail_number || !body.model || !body.capacity || !body.location || !body.year_manufactured) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if plane with same tail number already exists in this school
    const existingPlane = await (Plane.findOne({ 
      school_id: params.schoolId,
      tail_number: body.tail_number.toUpperCase()
    }) as any).exec();
    
    if (existingPlane) {
      return NextResponse.json(
        { error: 'Plane with this tail number already exists in this school' },
        { status: 400 }
      );
    }

    // Create new plane
    const plane = await (Plane.create({
      ...body,
      school_id: params.schoolId,
      tail_number: body.tail_number.toUpperCase() // Ensure tail number is uppercase
    }) as any);
    
    return NextResponse.json({
      message: 'Plane created successfully',
      plane
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating plane:', error);
    
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