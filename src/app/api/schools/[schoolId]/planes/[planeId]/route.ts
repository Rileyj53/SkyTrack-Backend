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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.planeId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Find plane by ID
    const plane = await (Plane as any).findById(params.planeId).lean();
    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found' },
        { status: 404 }
      );
    }

    // Check if plane belongs to school
    if (plane.school_id.toString() !== params.schoolId) {
      return NextResponse.json(
        { error: 'Plane not found in this school' },
        { status: 404 }
      );
    }

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

    return NextResponse.json({ plane: transformedPlane });
  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/planes/[planeId]:', error);
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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.planeId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json();

    // Find plane by ID
    const plane = await (Plane as any).findById(params.planeId);
    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found' },
        { status: 404 }
      );
    }

    // Check if plane belongs to school
    if (plane.school_id.toString() !== params.schoolId) {
      return NextResponse.json(
        { error: 'Plane not found in this school' },
        { status: 404 }
      );
    }

    // Validate hourlyRates if provided
    if (body.hourlyRates) {
      const requiredHourlyRates = ['wet', 'dry', 'block', 'instruction', 'weekend', 'solo', 'checkride'];
      for (const rate of requiredHourlyRates) {
        if (body.hourlyRates[rate] === undefined) {
          return NextResponse.json(
            { error: `Missing required hourly rate: ${rate}` },
            { status: 400 }
          );
        }
      }
    }

    // Ensure specialRates is an array if provided
    if (body.specialRates && !Array.isArray(body.specialRates)) {
      return NextResponse.json(
        { error: 'specialRates must be an array' },
        { status: 400 }
      );
    }

    // Remove _id fields from specialRates if present
    if (body.specialRates) {
      body.specialRates = body.specialRates.map((rate: any) => {
        const { _id, ...rateWithoutId } = rate;
        return rateWithoutId;
      });
    }

    // Update plane
    Object.assign(plane, body);
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

    return NextResponse.json({
      message: 'Plane updated successfully',
      plane: transformedPlane
    });
  } catch (error) {
    console.error('Error in PUT /api/schools/[schoolId]/planes/[planeId]:', error);
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

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.planeId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Find and delete plane
    const plane = await (Plane as any).findOneAndDelete({
      _id: params.planeId,
      school_id: params.schoolId
    });

    if (!plane) {
      return NextResponse.json(
        { error: 'Plane not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Plane deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/schools/[schoolId]/planes/[planeId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 