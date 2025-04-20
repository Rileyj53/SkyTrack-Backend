import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import mongoose from 'mongoose';
import Plane from '@/models/Plane';
import ServiceBulletin from '@/models/ServiceBulletin';

// PUT /api/schools/[schoolId]/planes/[planeId]/service-bulletins/[sbId] - Update a service bulletin
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string; sbId: string } }
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
        !mongoose.Types.ObjectId.isValid(params.sbId)) {
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

    // Find service bulletin by ID
    const serviceBulletin = await (ServiceBulletin as any).findById(params.sbId);
    if (!serviceBulletin) {
      return NextResponse.json(
        { error: 'Service bulletin not found' },
        { status: 404 }
      );
    }

    // Check if service bulletin belongs to plane
    if (serviceBulletin.aircraftId.toString() !== params.planeId) {
      return NextResponse.json(
        { error: 'Service bulletin not found for this plane' },
        { status: 404 }
      );
    }

    // Get request body
    const body = await request.json();

    // Validate status enum if provided
    if (body.status) {
      const validStatuses = ['Completed', 'Pending', 'Not Applicable'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({
          error: 'Invalid status value',
          details: `Status must be one of: ${validStatuses.join(', ')}`,
          received: body.status
        }, { status: 400 });
      }
    }

    // Validate date format if provided
    if (body.completionDate) {
      const date = new Date(body.completionDate);
      if (isNaN(date.getTime())) {
        return NextResponse.json({
          error: 'Invalid date format',
          details: 'completionDate must be a valid date',
          example: "2024-06-15"
        }, { status: 400 });
      }
    }

    // Update service bulletin
    Object.assign(serviceBulletin, body);
    await serviceBulletin.save();

    return NextResponse.json({
      message: 'Service bulletin updated successfully',
      serviceBulletin
    });
  } catch (error) {
    console.error('Error in PUT /api/schools/[schoolId]/planes/[planeId]/service-bulletins/[sbId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/planes/[planeId]/service-bulletins/[sbId] - Delete a service bulletin
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; planeId: string; sbId: string } }
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
        !mongoose.Types.ObjectId.isValid(params.sbId)) {
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

    // Find and delete service bulletin
    const serviceBulletin = await (ServiceBulletin as any).findOneAndDelete({
      _id: params.sbId,
      aircraftId: params.planeId
    });

    if (!serviceBulletin) {
      return NextResponse.json(
        { error: 'Service bulletin not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Service bulletin deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/schools/[schoolId]/planes/[planeId]/service-bulletins/[sbId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 