import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { School, SchoolDocument } from '@/models/School';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import mongoose from 'mongoose';
import { User } from '@/models/User';

// Security configuration for school-specific endpoints - requires authentication and school access
const SCHOOL_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  allowedRoles: ['sys_admin', 'school_admin'],
  requireSchoolAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

// GET /api/schools/[schoolId] - Get a specific school
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { schoolId: string }, securityContext: any }
) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'School details requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));

    // Validate school ID
    const { schoolId } = params;
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid school ID',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Role-based access control - school_admin can only access their own school
    if (securityContext.user?.role === 'school_admin') {
      if (securityContext.user?.school_id !== schoolId) {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'School admin attempted to access different school',
          auditId: securityContext.auditId,
          userId: securityContext.user?.userId,
          userSchoolId: securityContext.user?.school_id,
          requestedSchoolId: schoolId,
          timestamp: new Date().toISOString()
        }));

        return NextResponse.json({
          success: false,
          error: 'Access denied: You can only view your own school',
          auditId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }, { status: 403 });
      }
    }

    // Find school by ID, excluding sensitive payment information
    const school = await School.findById(schoolId).select('-payment_info.stripe_customer_id');
    
    if (!school) {
      return NextResponse.json({
        success: false,
        error: 'School not found',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'School details retrieved',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      schoolId: school._id,
      schoolName: school.name,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      success: true,
      message: 'School retrieved successfully',
      data: school,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error getting school',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      schoolId: params.schoolId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, SCHOOL_CONFIG);

// PUT /api/schools/[schoolId] - Update a school
export const PUT = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { schoolId: string }, securityContext: any }
) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'School update requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));

    // Validate school ID
    const { schoolId } = params;
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid school ID',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Role-based access control
    const role = securityContext.user?.role;
    
    // Only sys_admin and school_admin can update schools
    if (role !== 'sys_admin' && role !== 'school_admin') {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'User with insufficient permissions attempted to update school',
        auditId: securityContext.auditId,
        userId: securityContext.user?.userId,
        userRole: role,
        schoolId,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: false,
        error: 'Forbidden: Only system administrators and school administrators can update schools',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }
    
    // If school_admin, check if they belong to this school
    if (role === 'school_admin' && securityContext.user?.school_id !== schoolId) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'School admin attempted to update different school',
        auditId: securityContext.auditId,
        userId: securityContext.user?.userId,
        userSchoolId: securityContext.user?.school_id,
        requestedSchoolId: schoolId,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: false,
        error: 'Forbidden: School administrators can only update their own school',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    
    // Find school by ID
    const school = await School.findById(schoolId);
    
    if (!school) {
      return NextResponse.json({
        success: false,
        error: 'School not found',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Check if name is being changed and if it already exists
    if (body.name && body.name.trim() !== school.name) {
      const existingSchool = await School.findOne({ name: body.name.trim() });
      if (existingSchool) {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'Attempt to update school with duplicate name',
          auditId: securityContext.auditId,
          userId: securityContext.user?.userId,
          schoolId,
          newName: body.name.trim(),
          existingSchoolId: existingSchool._id,
          timestamp: new Date().toISOString()
        }));

        return NextResponse.json({
          success: false,
          error: 'School with this name already exists',
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

    // Update school
    const updatedSchool = await School.findByIdAndUpdate(
      schoolId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'School updated successfully',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      schoolId: updatedSchool._id,
      schoolName: updatedSchool.name,
      updatedFields: Object.keys(body),
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      success: true,
      message: 'School updated successfully',
      data: updatedSchool,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error updating school',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      schoolId: params.schoolId,
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
        error: 'School with this name already exists',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 409 });
    } else {
      throw error;
    }
  }
}, SCHOOL_CONFIG);

// DELETE /api/schools/[schoolId] - Delete a school (sys_admin only)
export const DELETE = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { schoolId: string }, securityContext: any }
) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'School deletion requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      userRole: securityContext.user?.role,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));

    // Check if user has sys_admin role - only sys_admin can delete schools
    if (securityContext.user?.role !== 'sys_admin') {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Non-sys_admin attempted to delete school',
        auditId: securityContext.auditId,
        userId: securityContext.user?.userId,
        userRole: securityContext.user?.role,
        schoolId: params.schoolId,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: false,
        error: 'Forbidden: Only system administrators can delete schools',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Validate school ID
    const { schoolId } = params;
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid school ID',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Find and delete school
    const school = await School.findByIdAndDelete(schoolId);
    
    if (!school) {
      return NextResponse.json({
        success: false,
        error: 'School not found',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'School deleted successfully',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      schoolId: school._id,
      schoolName: school.name,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      success: true,
      message: 'School deleted successfully',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error deleting school',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      schoolId: params.schoolId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, SCHOOL_CONFIG); 