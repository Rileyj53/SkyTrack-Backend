import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { School, SchoolDocument } from '@/models/School';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import mongoose from 'mongoose';

// Security configuration for schools endpoints - requires authentication and appropriate roles
const SCHOOLS_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  allowedRoles: ['sys_admin', 'school_admin'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

// GET /api/schools - List all schools (sys_admin only)
export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Schools list requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      userRole: securityContext.user?.role,
      timestamp: new Date().toISOString()
    }));

    // Check if user has sys_admin role - only sys_admin can list all schools
    if (securityContext.user?.role !== 'sys_admin') {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Non-sys_admin attempted to list all schools',
        auditId: securityContext.auditId,
        userId: securityContext.user?._id,
        userRole: securityContext.user?.role,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: false,
        error: 'Forbidden: Only system administrators can list all schools',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Find all schools, excluding sensitive payment information
    const schools = await School.find({}).select('-payment_info.stripe_customer_id');
    
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Schools list retrieved',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      schoolsCount: schools.length,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Schools retrieved successfully',
      data: schools,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      summary: {
        totalSchools: schools.length,
        accessLevel: 'sys_admin'
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error listing schools',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, SCHOOLS_CONFIG);

// POST /api/schools - Create a new school
export const POST = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'School creation requested',
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
        message: 'User with insufficient permissions attempted to create school',
        auditId: securityContext.auditId,
        userId: user?._id,
        userRole: user?.role || 'unknown',
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions: Only system administrators and school administrators can create schools',
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
        error: 'School name is required',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Validate school name format
    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'School name must be at least 2 characters long',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Check if school with same name already exists
    const existingSchool = await School.findOne({ name: body.name.trim() });
    if (existingSchool) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Attempt to create school with duplicate name',
        auditId: securityContext.auditId,
        userId: securityContext.user?.userId,
        schoolName: body.name.trim(),
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

    // Sanitize and prepare school data
    const schoolData = {
      ...body,
      name: body.name.trim(),
      created_by: securityContext.user?._id,
      created_at: new Date()
    };

    // Create new school
    const school = await School.create(schoolData);
    
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'School created successfully',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      schoolId: school._id,
      schoolName: school.name,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'School created successfully',
      data: school,
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error creating school',
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
        error: 'School with this name already exists',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 409 });
    } else {
      throw error;
    }
  }
}, SCHOOLS_CONFIG); 