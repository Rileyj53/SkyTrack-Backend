import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import mongoose from 'mongoose';
import { School } from '@/models/School';
import Program from '@/models/Program';

// GET /api/schools/[schoolId]/programs - Get all programs for a school
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

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Find school by ID
    const school = await (School as any).findById(params.schoolId);
    if (!school) {
      return NextResponse.json(
        { error: 'School not found' },
        { status: 404 }
      );
    }

    // Get all programs for the school
    const programs = await (Program as any).find({ school_id: params.schoolId })
      .sort({ program_name: 1 })
      .lean();

    return NextResponse.json({ programs });
  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/programs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/schools/[schoolId]/programs - Create a new program
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

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Find school by ID
    const school = await (School as any).findById(params.schoolId);
    if (!school) {
      return NextResponse.json(
        { error: 'School not found' },
        { status: 404 }
      );
    }

    // Get request body
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['program_name', 'requirements'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: missingFields.map(field => `${field} is required`),
        example: {
          program_name: "Private Pilot License",
          requirements: [
            { name: "Total Flight Time", hours: 18.5 },
            { name: "Dual Instruction", hours: 16.2 },
            { name: "Solo Flight Time", hours: 2.3 }
          ],
          description: "Complete training program for Private Pilot License",
          duration: "6 months",
          cost: 12000
        }
      }, { status: 400 });
    }

    // Validate requirements format
    if (!Array.isArray(body.requirements)) {
      return NextResponse.json({
        error: 'Invalid requirements format',
        details: 'Requirements must be an array of objects with name and hours properties',
        example: [
          { name: "Total Flight Time", hours: 18.5, type: "Standard" },
          { name: "Dual Instruction", hours: 16.2, type: "Key" }
        ]
      }, { status: 400 });
    }

    // Validate each requirement
    const invalidRequirements = body.requirements.filter(req => 
      !req.name || typeof req.hours !== 'number' || req.hours < 0
    );

    if (invalidRequirements.length > 0) {
      return NextResponse.json({
        error: 'Invalid requirement format',
        details: 'Each requirement must have a name (string) and hours (number >= 0)',
        example: { name: "Total Flight Time", hours: 18.5, type: "Standard" }
      }, { status: 400 });
    }

    // Validate milestones if provided
    if (body.milestones && !Array.isArray(body.milestones)) {
      return NextResponse.json({
        error: 'Invalid milestones format',
        details: 'Milestones must be an array of objects with name and order properties',
        example: [
          { name: "First Solo", description: "Student's first solo flight", order: 1 },
          { name: "Cross Country", description: "First cross country flight", order: 2 }
        ]
      }, { status: 400 });
    }

    // Validate each milestone
    if (body.milestones) {
      const invalidMilestones = body.milestones.filter(milestone => 
        !milestone.name || typeof milestone.order !== 'number' || milestone.order < 0
      );

      if (invalidMilestones.length > 0) {
        return NextResponse.json({
          error: 'Invalid milestone format',
          details: 'Each milestone must have a name (string) and order (number >= 0)',
          example: { name: "First Solo", description: "Student's first solo flight", order: 1 }
        }, { status: 400 });
      }
    }

    // Validate stages if provided
    if (body.stages && !Array.isArray(body.stages)) {
      return NextResponse.json({
        error: 'Invalid stages format',
        details: 'Stages must be an array of objects with name and order properties',
        example: [
          { name: "Pre-Solo", description: "Training before first solo", order: 1 },
          { name: "Post-Solo", description: "Training after first solo", order: 2 }
        ]
      }, { status: 400 });
    }

    // Validate each stage
    if (body.stages) {
      const invalidStages = body.stages.filter(stage => 
        !stage.name || typeof stage.order !== 'number' || stage.order < 0
      );

      if (invalidStages.length > 0) {
        return NextResponse.json({
          error: 'Invalid stage format',
          details: 'Each stage must have a name (string) and order (number >= 0)',
          example: { name: "Pre-Solo", description: "Training before first solo", order: 1 }
        }, { status: 400 });
      }
    }

    // Create new program
    const program = new (Program as any)({
      ...body,
      school_id: params.schoolId
    });

    try {
      await program.save();
    } catch (saveError: any) {
      // Handle duplicate key error
      if (saveError.code === 11000) {
        return NextResponse.json({
          error: 'Duplicate program',
          details: `A program with name "${body.program_name}" already exists for this school`
        }, { status: 409 });
      }
      throw saveError;
    }

    return NextResponse.json({
      message: 'Program created successfully',
      program
    });
  } catch (error) {
    console.error('Error in POST /api/schools/[schoolId]/programs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 