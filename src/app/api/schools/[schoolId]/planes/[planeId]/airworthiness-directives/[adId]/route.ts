import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import mongoose from 'mongoose';
import Plane from '@/models/Plane';
import AirworthinessDirective from '@/models/AirworthinessDirective';

// PUT /api/schools/[schoolId]/planes/[planeId]/airworthiness-directives/[adId] - Update an airworthiness directive
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string; adId: string } }
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
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || 
        !mongoose.Types.ObjectId.isValid(params.planeId) || 
        !mongoose.Types.ObjectId.isValid(params.adId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

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

    // Find airworthiness directive by ID
    const airworthinessDirective = await (AirworthinessDirective as any).findById(params.adId);
    if (!airworthinessDirective) {
      return NextResponse.json(
        { error: 'Airworthiness directive not found' },
        { status: 404 }
      );
    }

    // Check if airworthiness directive belongs to plane
    if (airworthinessDirective.aircraftId.toString() !== params.planeId) {
      return NextResponse.json(
        { error: 'Airworthiness directive not found for this plane' },
        { status: 404 }
      );
    }

    // Get request body
    const body = await request.json();

    // Validate status enum if provided
    if (body.status) {
      const validStatuses = ['Compliant', 'Pending', 'Not Applicable'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({
          error: 'Invalid status value',
          details: `Status must be one of: ${validStatuses.join(', ')}`,
          received: body.status
        }, { status: 400 });
      }
    }

    // Validate date formats if provided
    const dateFields = ['complianceDate', 'nextDueDate'];
    const invalidDates = dateFields.filter(field => {
      if (body[field]) {
        const date = new Date(body[field]);
        return isNaN(date.getTime());
      }
      return false;
    });

    if (invalidDates.length > 0) {
      return NextResponse.json({
        error: 'Invalid date format',
        details: invalidDates.map(field => `${field} must be a valid date`),
        example: "2024-05-15"
      }, { status: 400 });
    }

    // Update airworthiness directive
    Object.assign(airworthinessDirective, body);
    await airworthinessDirective.save();

    return NextResponse.json({
      message: 'Airworthiness directive updated successfully',
      airworthinessDirective
    });
  } catch (error) {
    console.error('Error in PUT /api/schools/[schoolId]/planes/[planeId]/airworthiness-directives/[adId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/planes/[planeId]/airworthiness-directives/[adId] - Delete an airworthiness directive
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string; adId: string } }
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
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || 
        !mongoose.Types.ObjectId.isValid(params.planeId) || 
        !mongoose.Types.ObjectId.isValid(params.adId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

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

    // Find and delete airworthiness directive
    const airworthinessDirective = await (AirworthinessDirective as any).findOneAndDelete({
      _id: params.adId,
      aircraftId: params.planeId
    });

    if (!airworthinessDirective) {
      return NextResponse.json(
        { error: 'Airworthiness directive not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Airworthiness directive deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/schools/[schoolId]/planes/[planeId]/airworthiness-directives/[adId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 