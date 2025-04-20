import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import mongoose from 'mongoose';
import { School } from '@/models/School';
import Program from '@/models/Program';

// GET /api/schools/[schoolId]/programs/[programId] - Get a specific program
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string; programId: string } }
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
        !mongoose.Types.ObjectId.isValid(params.programId)) {
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

    // Find program by ID
    const program = await (Program as any).findOne({
      _id: params.programId,
      school_id: params.schoolId
    }).lean();

    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ program });
  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/programs/[programId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId]/programs/[programId] - Update a program
export async function PUT(
  request: NextRequest,
  { params }: { params: { schoolId: string; programId: string } }
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
        !mongoose.Types.ObjectId.isValid(params.programId)) {
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

    // Find program by ID
    const program = await (Program as any).findOne({
      _id: params.programId,
      school_id: params.schoolId
    });

    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    // Get request body
    const body = await request.json();

    // Validate requirements format if provided
    if (body.requirements && !Array.isArray(body.requirements)) {
      return NextResponse.json({
        error: 'Invalid requirements format',
        details: 'Requirements must be an array of objects with name, hours, and type properties',
        example: [
          { name: "Total Flight Time", hours: 18.5, type: "Standard" },
          { name: "Dual Instruction", hours: 16.2, type: "Key" }
        ]
      }, { status: 400 });
    }

    // Validate each requirement if provided
    if (body.requirements) {
      const invalidRequirements = body.requirements.filter(req => 
        !req.name || typeof req.hours !== 'number' || req.hours < 0 || !req.type || !['Standard', 'Key', 'Custom'].includes(req.type)
      );

      if (invalidRequirements.length > 0) {
        return NextResponse.json({
          error: 'Invalid requirement format',
          details: 'Each requirement must have a name (string), hours (number >= 0), and type (Standard, Key, or Custom)',
          example: { name: "Total Flight Time", hours: 18.5, type: "Standard" }
        }, { status: 400 });
      }
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

    // Validate each milestone if provided
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

    // Validate each stage if provided
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

    // Update program
    Object.assign(program, body);
    await program.save();

    return NextResponse.json({
      message: 'Program updated successfully',
      program
    });
  } catch (error) {
    console.error('Error in PUT /api/schools/[schoolId]/programs/[programId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/programs/[programId] - Delete a program
export async function DELETE(
  request: NextRequest,
  { params }: { params: { schoolId: string; programId: string } }
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
        !mongoose.Types.ObjectId.isValid(params.programId)) {
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

    // Find and delete program
    const program = await (Program as any).findOneAndDelete({
      _id: params.programId,
      school_id: params.schoolId
    });

    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Program deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/schools/[schoolId]/programs/[programId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 