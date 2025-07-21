import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import { School } from '@/models/School';
import Program from '@/models/Program';

// Security configuration for individual program endpoints
const PROGRAM_DETAIL_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // Required for PUT/DELETE operations
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

// GET /api/organizations/[organization]/programs/[programId] - Get a specific program
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, programId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing program details request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    programId: params.programId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organization) || 
      !mongoose.Types.ObjectId.isValid(params.programId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid ID format provided',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      programId: params.programId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
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

  // Find program by ID (still using organization_id in database for now)
  const program = await (Program as any).findOne({
    _id: params.programId,
    organization_id: params.organization
  }).lean();

  if (!program) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Program not found',
      auditId: securityContext.auditId,
      programId: params.programId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Program not found',
        code: 'PROGRAM_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Program details request completed successfully',
    auditId: securityContext.auditId,
    programId: params.programId,
    programName: program.program_name,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Program retrieved successfully',
    data: {
      program
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PROGRAM_DETAIL_SECURITY_CONFIG);

// PUT /api/organizations/[organization]/programs/[programId] - Update a program
export const PUT = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, programId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing program update request',
    auditId: securityContext.auditId,
    organizationId: params.organizationId,
    programId: params.programId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can update programs
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to update program',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      programId: params.programId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to update programs',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organizationId) || 
      !mongoose.Types.ObjectId.isValid(params.programId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid ID format provided for program update',
      auditId: securityContext.auditId,
      organizationId: params.organizationId,
      programId: params.programId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find organization by ID (still using School model for now)
  const organization = await (School as any).findById(params.organizationId);
  if (!organization) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Organization not found for program update',
      auditId: securityContext.auditId,
      organizationId: params.organizationId,
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

  // Find program by ID (still using organization_id in database for now)
  const program = await (Program as any).findOne({
    _id: params.programId,
    organization_id: params.organizationId
  });

  if (!program) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Program not found for update',
      auditId: securityContext.auditId,
      programId: params.programId,
      organizationId: params.organizationId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Program not found',
        code: 'PROGRAM_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Get request body
  const body = await request.json();

  // Store original values for audit logging
  const originalValues = {
    program_name: program.program_name,
    description: program.description,
    duration: program.duration,
    cost: program.cost
  };

  // Validate requirements format if provided
  if (body.requirements && !Array.isArray(body.requirements)) {
    return NextResponse.json({
      error: {
        message: 'Invalid requirements format',
        code: 'INVALID_REQUIREMENTS_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        details: 'Requirements must be an array of objects with name, hours, and type properties',
        example: [
          { name: "Total Flight Time", hours: 18.5, type: "Standard" },
          { name: "Dual Instruction", hours: 16.2, type: "Key" }
        ]
      }
    }, { status: 400 });
  }

  // Validate each requirement if provided
  if (body.requirements) {
    const invalidRequirements = body.requirements.filter(req => 
      !req.name || typeof req.hours !== 'number' || req.hours < 0 || !req.type || !['Standard', 'Key', 'Custom'].includes(req.type)
    );

    if (invalidRequirements.length > 0) {
      return NextResponse.json({
        error: {
          message: 'Invalid requirement format',
          code: 'INVALID_REQUIREMENT_FORMAT',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString(),
          details: 'Each requirement must have a name (string), hours (number >= 0), and type (Standard, Key, or Custom)',
          example: { name: "Total Flight Time", hours: 18.5, type: "Standard" }
        }
      }, { status: 400 });
    }
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

  // Validate each milestone if provided
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

  // Validate each stage if provided
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

  // Update program
  Object.assign(program, body);
  await program.save();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Program updated successfully',
    auditId: securityContext.auditId,
    programId: params.programId,
    programName: program.program_name,
    updatedBy: securityContext.user?.id,
    changes: {
      program_name: originalValues.program_name !== program.program_name,
      description: originalValues.description !== program.description,
      duration: originalValues.duration !== program.duration,
      cost: originalValues.cost !== program.cost
    },
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Program updated successfully',
    data: {
      program
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PROGRAM_DETAIL_SECURITY_CONFIG);

// DELETE /api/organizations/[organization]/programs/[programId] - Delete a program
export const DELETE = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, programId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing program deletion request',
    auditId: securityContext.auditId,
    organizationId: params.organizationId,
    programId: params.programId,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can delete programs
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to delete program',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      programId: params.programId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to delete programs',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.organizationId) || 
      !mongoose.Types.ObjectId.isValid(params.programId)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid ID format provided for program deletion',
      auditId: securityContext.auditId,
      organizationId: params.organizationId,
      programId: params.programId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find organization by ID (still using School model for now)
  const organization = await (School as any).findById(params.organizationId);
  if (!organization) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Organization not found for program deletion',
      auditId: securityContext.auditId,
      organizationId: params.organizationId,
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

  // Find and delete program (still using organization_id in database for now)
  const program = await (Program as any).findOneAndDelete({
    _id: params.programId,
    organization_id: params.organizationId
  });

  if (!program) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Program not found for deletion',
      auditId: securityContext.auditId,
      programId: params.programId,
      organizationId: params.organizationId,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Program not found',
        code: 'PROGRAM_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Program deleted successfully',
    auditId: securityContext.auditId,
    programId: params.programId,
    programName: program.program_name,
    organizationId: params.organizationId,
    deletedBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Program deleted successfully',
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, PROGRAM_DETAIL_SECURITY_CONFIG); 