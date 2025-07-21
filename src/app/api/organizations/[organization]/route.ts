import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { School, SchoolDocument } from '@/models/School';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import mongoose from 'mongoose';
import { User } from '@/models/User';

// Security configuration for organization-specific endpoints - requires authentication and organization access
const ORGANIZATION_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  allowedRoles: ['sys_admin', 'school_admin'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

// GET /api/organizations/[organizationId] - Get a specific organization
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization details requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      userRole: securityContext.user?.role,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));

    // Validate organization ID
    const organizationId = params.organization;
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid organization ID',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Role-based access control - school_admin can only access their own organization
    if (securityContext.user?.role === 'school_admin') {
      if (securityContext.user?.organization_id?.toString() !== organizationId) {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'School admin attempted to access different organization',
          auditId: securityContext.auditId,
          userId: securityContext.user?._id,
          userSchoolId: securityContext.user?.organization_id,
          requestedOrganizationId: organizationId,
          timestamp: new Date().toISOString()
        }));

        return NextResponse.json({
          success: false,
          error: 'Access denied: You can only view your own organization',
          auditId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }, { status: 403 });
      }
    }

    // Find organization by ID, excluding sensitive payment information (still using School model for now)
    const organization = await School.findById(organizationId).select('-payment_info.stripe_customer_id');
    
    if (!organization) {
      return NextResponse.json({
        success: false,
        error: 'Organization not found',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization details retrieved',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      organizationId: organization._id,
      organizationName: organization.name,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      success: true,
      message: 'Organization retrieved successfully',
      data: organization,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error getting organization',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      organizationId: params.organization,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, ORGANIZATION_CONFIG);

// PUT /api/organizations/[organizationId] - Update an organization
export const PUT = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization update requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      userRole: securityContext.user?.role,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));

    // Validate organization ID
    const organizationId = params.organization;
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid organization ID',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Role-based access control
    const role = securityContext.user?.role;
    
    // Only sys_admin and school_admin can update organizations
    if (role !== 'sys_admin' && role !== 'school_admin') {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'User with insufficient permissions attempted to update organization',
        auditId: securityContext.auditId,
        userId: securityContext.user?._id,
        userRole: role,
        organizationId,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: false,
        error: 'Forbidden: Only system administrators and organization administrators can update organizations',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }
    
    // If school_admin, check if they belong to this organization
    if (role === 'school_admin' && securityContext.user?.organization_id !== organizationId) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'School admin attempted to update different organization',
        auditId: securityContext.auditId,
        userId: securityContext.user?._id,
        userSchoolId: securityContext.user?.organization_id,
        requestedOrganizationId: organizationId,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: false,
        error: 'Forbidden: Organization administrators can only update their own organization',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    
    // Find organization by ID (still using School model for now)
    const organization = await School.findById(organizationId);
    
    if (!organization) {
      return NextResponse.json({
        success: false,
        error: 'Organization not found',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Check if name is being changed and if it already exists
    if (body.name && body.name.trim() !== organization.name) {
      const existingOrganization = await School.findOne({ name: body.name.trim() });
      if (existingOrganization) {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'Attempt to update organization with duplicate name',
          auditId: securityContext.auditId,
          userId: securityContext.user?._id,
          organizationId,
          newName: body.name.trim(),
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
    }

    // Sanitize update data
    const updateData = {
      ...body,
      name: body.name ? body.name.trim() : body.name,
      updated_by: securityContext.user?.userId,
      updated_at: new Date()
    };

    // Update organization (still using School model for now)
    const updatedOrganization = await School.findByIdAndUpdate(
      organizationId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization updated successfully',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      organizationId: updatedOrganization._id,
      organizationName: updatedOrganization.name,
      updatedFields: Object.keys(body),
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      success: true,
      message: 'Organization updated successfully',
      data: updatedOrganization,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error updating organization',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      organizationId: params.organization,
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
}, ORGANIZATION_CONFIG);

// DELETE /api/organizations/[organizationId] - Delete an organization (sys_admin only)
export const DELETE = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization deletion requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      userRole: securityContext.user?.role,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));

    // Check if user has sys_admin role - only sys_admin can delete organizations
    if (securityContext.user?.role !== 'sys_admin') {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Non-sys_admin attempted to delete organization',
        auditId: securityContext.auditId,
        userId: securityContext.user?._id,
        userRole: securityContext.user?.role,
        organizationId: params.organization,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: false,
        error: 'Forbidden: Only system administrators can delete organizations',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Validate organization ID
    const organizationId = params.organization;
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid organization ID',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Find and delete organization (still using School model for now)
    const organization = await School.findByIdAndDelete(organizationId);
    
    if (!organization) {
      return NextResponse.json({
        success: false,
        error: 'Organization not found',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization deleted successfully',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      organizationId: organization._id,
      organizationName: organization.name,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      success: true,
      message: 'Organization deleted successfully',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error deleting organization',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      organizationId: params.organization,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, ORGANIZATION_CONFIG); 