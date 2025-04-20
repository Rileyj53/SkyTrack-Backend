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

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID format' },
        { status: 400 }
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

    // Find all planes for this school
    const planes = await (Plane as any).find({ school_id: params.schoolId }).lean();
    
    // Transform the response to match the expected format
    const transformedPlanes = planes.map(plane => ({
      id: plane._id,
      registration: plane.registration,
      type: plane.type,
      model: plane.model,
      year: plane.year,
      engineHours: plane.engineHours,
      tach_time: plane.tach_time,
      hopps_time: plane.hopps_time,
      lastMaintenance: plane.lastMaintenance,
      nextMaintenance: plane.nextMaintenance,
      status: plane.status,
      hourlyRates: plane.hourlyRates,
      specialRates: plane.specialRates,
      utilization: plane.utilization,
      location: plane.location,
      notes: plane.notes
    }));
    
    return NextResponse.json({
      planes: transformedPlanes
    });
  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/planes:', error);
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

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID format' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      'registration',
      'type',
      'model',
      'year',
      'engineHours',
      'status',
      'location',
      'hourlyRates'
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate hourlyRates fields
    const requiredHourlyRates = ['wet', 'dry', 'block', 'instruction', 'weekend', 'solo', 'checkride'];
    for (const rate of requiredHourlyRates) {
      if (body.hourlyRates[rate] === undefined) {
        return NextResponse.json(
          { error: `Missing required hourly rate: ${rate}` },
          { status: 400 }
        );
      }
    }

    // Check if plane with registration already exists
    const existingPlane = await (Plane as any).findOne({
      registration: body.registration.toUpperCase(),
      school_id: params.schoolId
    }).lean();

    if (existingPlane) {
      return NextResponse.json(
        { error: 'A plane with this registration already exists' },
        { status: 400 }
      );
    }

    // Create new plane
    const plane = new Plane({
      ...body,
      registration: body.registration.toUpperCase(),
      school_id: params.schoolId,
      // Ensure specialRates is an array
      specialRates: body.specialRates || []
    });

    await plane.save();

    // Transform the response to match the expected format
    const transformedPlane = {
      id: plane._id,
      registration: plane.registration,
      type: plane.type,
      model: plane.model,
      year: plane.year,
      engineHours: plane.engineHours,
      tach_time: plane.tach_time,
      hopps_time: plane.hopps_time,
      lastMaintenance: plane.lastMaintenance,
      nextMaintenance: plane.nextMaintenance,
      status: plane.status,
      hourlyRates: plane.hourlyRates,
      specialRates: plane.specialRates,
      utilization: plane.utilization,
      location: plane.location,
      notes: plane.notes
    };

    return NextResponse.json(
      { message: 'Plane created successfully', plane: transformedPlane },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/schools/[schoolId]/planes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 