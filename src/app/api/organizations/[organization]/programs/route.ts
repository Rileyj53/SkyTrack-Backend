import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import { School } from '@/models/School';
import Program from '@/models/Program';

// Security configuration for program endpoints
const PROGRAM_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // Required for POST operations
  allowedRoles: ['sys_admin', 'school_admin', 'instructor'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET /api/organizations/[organization]/programs - Get all programs for an organization
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing programs list request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate organization ID
  if (!mongoose.Types.ObjectId.isValid(params.organization)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID format provided',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID format',
        code: 'INVALID_ORGANIZATION_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find organization by ID (still using School model for now)
  const organization = await (School as any).findById(params.organization);
  if (!organization) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Organization not found',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Organization not found',
        code: 'ORGANIZATION_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Get all programs for the organization (still using organization_id in database for now)
  const programs = await (Program as any).find({ organization_id: params.organization })
    .sort({ program_name: 1 })
    .lean();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Programs list request completed successfully',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    programsCount: programs.length,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Programs retrieved successfully',
    data: {
      programs
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PROGRAM_SECURITY_CONFIG);

// POST /api/organizations/[organization]/programs - Create a new program
export const POST = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing program creation request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can create programs
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to create program',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to create programs',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate organization ID
  if (!mongoose.Types.ObjectId.isValid(params.organization)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID format provided for program creation',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID format',
        code: 'INVALID_ORGANIZATION_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find organization by ID (still using School model for now)
  const organization = await (School as any).findById(params.organization);
  if (!organization) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Organization not found for program creation',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Organization not found',
        code: 'ORGANIZATION_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Get request body
  const body = await request.json();

  // Validate required fields
  const requiredFields = ['program_name', 'requirements'];
  const missingFields = requiredFields.filter(field => !body[field]);
  
  if (missingFields.length > 0) {
    return NextResponse.json({
      error: {
        message: 'Missing required fields',
        code: 'MISSING_REQUIRED_FIELDS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
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
      }
    }, { status: 400 });
  }

  // Validate requirements format
  if (!Array.isArray(body.requirements)) {
    return NextResponse.json({
      error: {
        message: 'Invalid requirements format',
        code: 'INVALID_REQUIREMENTS_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        details: 'Requirements must be an array of objects with name and hours properties',
        example: [
          { name: "Total Flight Time", hours: 18.5, type: "Standard" },
          { name: "Dual Instruction", hours: 16.2, type: "Key" }
        ]
      }
    }, { status: 400 });
  }

  // Validate each requirement
  const invalidRequirements = body.requirements.filter(req => 
    !req.name || typeof req.hours !== 'number' || req.hours < 0
  );

  if (invalidRequirements.length > 0) {
    return NextResponse.json({
      error: {
        message: 'Invalid requirement format',
        code: 'INVALID_REQUIREMENT_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        details: 'Each requirement must have a name (string) and hours (number >= 0)',
        example: { name: "Total Flight Time", hours: 18.5, type: "Standard" }
      }
    }, { status: 400 });
  }

  // Validate milestones if provided
  if (body.milestones && !Array.isArray(body.milestones)) {
    return NextResponse.json({
      error: {
        message: 'Invalid milestones format',
        code: 'INVALID_MILESTONES_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        details: 'Milestones must be an array of objects with name and order properties',
        example: [
          { name: "First Solo", description: "Student's first solo flight", order: 1 },
          { name: "Cross Country", description: "First cross country flight", order: 2 }
        ]
      }
    }, { status: 400 });
  }

  // Validate each milestone
  if (body.milestones) {
    const invalidMilestones = body.milestones.filter(milestone => 
      !milestone.name || typeof milestone.order !== 'number' || milestone.order < 0
    );

    if (invalidMilestones.length > 0) {
      return NextResponse.json({
        error: {
          message: 'Invalid milestone format',
          code: 'INVALID_MILESTONE_FORMAT',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString(),
          details: 'Each milestone must have a name (string) and order (number >= 0)',
          example: { name: "First Solo", description: "Student's first solo flight", order: 1 }
        }
      }, { status: 400 });
    }
  }

  // Validate stages if provided
  if (body.stages && !Array.isArray(body.stages)) {
    return NextResponse.json({
      error: {
        message: 'Invalid stages format',
        code: 'INVALID_STAGES_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        details: 'Stages must be an array of objects with name and order properties',
        example: [
          { name: "Pre-Solo", description: "Training before first solo", order: 1 },
          { name: "Post-Solo", description: "Training after first solo", order: 2 }
        ]
      }
    }, { status: 400 });
  }

  // Validate each stage
  if (body.stages) {
    const invalidStages = body.stages.filter(stage => 
      !stage.name || typeof stage.order !== 'number' || stage.order < 0
    );

    if (invalidStages.length > 0) {
      return NextResponse.json({
        error: {
          message: 'Invalid stage format',
          code: 'INVALID_STAGE_FORMAT',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString(),
          details: 'Each stage must have a name (string) and order (number >= 0)',
          example: { name: "Pre-Solo", description: "Training before first solo", order: 1 }
        }
      }, { status: 400 });
    }
  }

  // Create new program (still using organization_id in database for now)
  const program = new (Program as any)({
    ...body,
    organization_id: params.organization
  });

  try {
    await program.save();
  } catch (saveError: any) {
    // Handle duplicate key error
    if (saveError.code === 11000) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Duplicate program name attempted',
        auditId: securityContext.auditId,
        programName: body.program_name,
        organizationId: params.organization,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Duplicate program',
          code: 'PROGRAM_EXISTS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString(),
          details: `A program with name "${body.program_name}" already exists for this organization`
        }
      }, { status: 409 });
    }
    throw saveError;
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Program created successfully',
    auditId: securityContext.auditId,
    programId: program._id,
    programName: program.program_name,
    organizationId: params.organization,
    createdBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Program created successfully',
    data: {
      program
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }, { status: 201 });
}, PROGRAM_SECURITY_CONFIG); 