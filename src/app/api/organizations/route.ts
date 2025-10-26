import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { School, SchoolDocument } from '@/models/School';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import mongoose from 'mongoose';

// Security configuration for organizations endpoints - requires authentication and appropriate roles
const ORGANIZATIONS_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

// GET /api/organizations - List all organizations (sys_admin only)
export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organizations list requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      userRole: securityContext.user?.role,
      timestamp: new Date().toISOString()
    }));

    // Check if user has sys_admin role - only sys_admin can list all organizations
    if (securityContext.user?.role !== 'sys_admin') {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Non-sys_admin attempted to list all organizations',
        auditId: securityContext.auditId,
        userId: securityContext.user?._id,
        userRole: securityContext.user?.role,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: false,
        error: 'Forbidden: Only system administrators can list all organizations',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Find all organizations, excluding sensitive payment information
    const organizations = await School.find({}).select('-payment_info.stripe_customer_id');
    
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organizations list retrieved',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      organizationsCount: organizations.length,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Organizations retrieved successfully',
      data: organizations,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      summary: {
        totalOrganizations: organizations.length,
        accessLevel: 'sys_admin'
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error listing organizations',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, ORGANIZATIONS_CONFIG);

// POST /api/organizations - Create a new organization
export const POST = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization creation requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      userRole: securityContext.user?.role,
      timestamp: new Date().toISOString()
    }));

    // Check if user has appropriate permissions
    const user = securityContext.user;
    if (!user || (user.role !== 'sys_admin' && user.role !== 'school_admin')) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'User with insufficient permissions attempted to create organization',
        auditId: securityContext.auditId,
        userId: user?._id,
        userRole: user?.role || 'unknown',
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions: Only system administrators and organization administrators can create organizations',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.name) {
      return NextResponse.json({
        success: false,
        error: 'Organization name is required',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Validate organization name format
    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Organization name must be at least 2 characters long',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Check if organization with same name already exists
    const existingOrganization = await School.findOne({ name: body.name.trim() });
    if (existingOrganization) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Attempt to create organization with duplicate name',
        auditId: securityContext.auditId,
        userId: securityContext.user?.userId,
        organizationName: body.name.trim(),
        existingOrganizationId: existingOrganization._id,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: false,
        error: 'Organization with this name already exists',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 409 });
    }

    // Sanitize and prepare organization data
    const organizationData = {
      ...body,
      name: body.name.trim(),
      created_by: securityContext.user?._id,
      created_at: new Date()
    };

    // Create new organization
    const organization = await School.create(organizationData);
    
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization created successfully',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      organizationId: organization._id,
      organizationName: organization.name,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Organization created successfully',
      data: organization,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error creating organization',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({
        success: false,
        error: error.message,
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    } else if (error.code === 11000) {
      return NextResponse.json({
        success: false,
        error: 'Organization with this name already exists',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 409 });
    } else {
      throw error;
    }
  }
}, ORGANIZATIONS_CONFIG); 