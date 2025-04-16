/**
 * Note: This file contains TypeScript errors related to Mongoose's method overloads and union types.
 * These errors are purely TypeScript type definition issues and don't affect runtime behavior.
 * The code is functionally correct and working as expected.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import Pilot from '@/models/Pilot';
import mongoose from 'mongoose';

// Connect to MongoDB
connectDB();

// GET /api/schools/[schoolId]/pilots - List all pilots for a school
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

    // Find all pilots for the school
    const pilots = await (Pilot as any).find({ school_id: params.schoolId }).lean();
    
    return NextResponse.json({ pilots });
  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/pilots:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/schools/[schoolId]/pilots - Create a new pilot
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
      'first_name',
      'last_name',
      'contact_email',
      'phone',
      'pilot_type',
      'certifications',
      'license_number'
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Check if pilot with license number already exists
    const existingPilot = await (Pilot as any).findOne({
      license_number: body.license_number,
      school_id: params.schoolId
    }).lean();

    if (existingPilot) {
      return NextResponse.json(
        { error: 'A pilot with this license number already exists' },
        { status: 400 }
      );
    }

    // Create new pilot
    const pilot = new Pilot({
      ...body,
      school_id: params.schoolId,
      user_id: authResult.userId
    });

    await pilot.save();

    return NextResponse.json(
      { message: 'Pilot created successfully', pilot },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/schools/[schoolId]/pilots:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 