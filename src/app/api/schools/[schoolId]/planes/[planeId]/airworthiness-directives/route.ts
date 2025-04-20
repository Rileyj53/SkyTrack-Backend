import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import mongoose from 'mongoose';
import Plane from '@/models/Plane';
import AirworthinessDirective from '@/models/AirworthinessDirective';

// GET /api/schools/[schoolId]/planes/[planeId]/airworthiness-directives - Get all airworthiness directives for a plane
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

    // Get all airworthiness directives for the plane
    const airworthinessDirectives = await (AirworthinessDirective as any).find({ aircraftId: params.planeId })
      .sort({ adNumber: 1 })
      .lean(); // Use lean() to get plain JavaScript objects

    return NextResponse.json({ airworthinessDirectives });
  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/planes/[planeId]/airworthiness-directives:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/schools/[schoolId]/planes/[planeId]/airworthiness-directives - Create a new airworthiness directive
export async function POST(
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

    // Get request body
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['adNumber', 'title', 'description', 'status'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: missingFields.map(field => `${field} is required`),
        example: {
          adNumber: "2024-02-15",
          title: "Fuel System Component Replacement",
          description: "Mandatory replacement of fuel selector valve",
          status: "Pending",
          complianceDate: "2024-05-15",
          nextDueDate: "2025-05-15",
          notes: "Optional notes about the AD"
        }
      }, { status: 400 });
    }

    // Validate status enum
    const validStatuses = ['Compliant', 'Pending', 'Not Applicable'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({
        error: 'Invalid status value',
        details: `Status must be one of: ${validStatuses.join(', ')}`,
        received: body.status
      }, { status: 400 });
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

    // Create new airworthiness directive
    const airworthinessDirective = new (AirworthinessDirective as any)({
      ...body,
      aircraftId: params.planeId
    });

    try {
      await airworthinessDirective.save();
    } catch (saveError: any) {
      // Handle duplicate key error
      if (saveError.code === 11000) {
        return NextResponse.json({
          error: 'Duplicate airworthiness directive',
          details: `An AD with number ${body.adNumber} already exists for this aircraft`
        }, { status: 409 });
      }
      throw saveError;
    }

    return NextResponse.json({
      message: 'Airworthiness directive created successfully',
      airworthinessDirective
    });
  } catch (error) {
    console.error('Error in POST /api/schools/[schoolId]/planes/[planeId]/airworthiness-directives:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 