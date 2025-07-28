import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import Student from '@/models/Student';

// GET security configuration
const STUDENT_GET_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: false, // GET request, CSRF not required
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin', 'instructor', 'student', 'mechanic', 'member'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000
  }
};

// PUT security configuration (higher security for student modification)
const STUDENT_MODIFY_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin', 'instructor', 'student', 'mechanic', 'member'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 50,
    windowMs: 60000
  }
};

// DELETE security configuration (highest security for student deletion)
const STUDENT_DELETE_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 10,
    windowMs: 60000
  }
};

// GET handler to get a specific student
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, studentId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing student details request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    studentId: params.studentId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate that the provided ID is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(params.studentId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid ID format - must be a valid ObjectId',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  let student: any = null;
  let searchType = '';

  // First, try to find the student by student ID
  try {
    student = await mongoose.model('Student').findOne({
      _id: new mongoose.Types.ObjectId(params.studentId),
      organization_id: new mongoose.Types.ObjectId(params.organization)
    }).populate('user_id', 'first_name last_name email role').lean();
    
    if (student) {
      searchType = 'student_id';
    }
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Error searching by student ID',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
  }

  // If not found by student ID, try to find by user ID
  if (!student) {
    try {
      student = await mongoose.model('Student').findOne({
        user_id: new mongoose.Types.ObjectId(params.studentId),
        organization_id: new mongoose.Types.ObjectId(params.organization)
      }).populate('user_id', 'first_name last_name email role').lean();
      
      if (student) {
        searchType = 'user_id';
      }
    } catch (error) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Error searching by user ID',
        auditId: securityContext.auditId,
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  }

  // If still not found, return error
  if (!student) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Student not found by student ID or user ID',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      providedId: params.studentId,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Student not found in this organization. The provided ID was not found as either a student ID or user ID.',
        code: 'STUDENT_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        details: {
          providedId: params.studentId,
          searchedBy: ['student_id', 'user_id'],
          organizationId: params.organization
        }
      }
    }, { status: 404 });
  }

  // Additional access control for students - they can only view their own record
  if (securityContext.user.role === 'student') {
    const studentData = student as any;
    if (!studentData.user_id || studentData.user_id._id.toString() !== securityContext.user.id) {
      return NextResponse.json({
        error: {
          message: 'Students can only access their own records',
          code: 'INSUFFICIENT_PERMISSIONS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 403 });
    }
  }

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Student details retrieved successfully',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    studentId: student._id.toString(),
    userId: student.user_id?._id?.toString(),
    searchType: searchType,
    providedId: params.studentId,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Student retrieved successfully',
    data: student,
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString(),
    searchInfo: {
      providedId: params.studentId,
      foundBy: searchType,
      studentId: student._id.toString(),
      userId: student.user_id?._id?.toString()
    }
  });
}, STUDENT_GET_SECURITY_CONFIG);

// PUT handler to update a student
export const PUT = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, studentId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing student update request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    studentId: params.studentId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate that the provided ID is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(params.studentId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid ID format - must be a valid ObjectId',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  let student: any = null;
  let searchType = '';

  // First, try to find the student by student ID
  try {
    student = await mongoose.model('Student').findOne({
      _id: new mongoose.Types.ObjectId(params.studentId),
      organization_id: new mongoose.Types.ObjectId(params.organization)
    });
    
    if (student) {
      searchType = 'student_id';
    }
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Error searching by student ID for update',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
  }

  // If not found by student ID, try to find by user ID
  if (!student) {
    try {
      student = await mongoose.model('Student').findOne({
        user_id: new mongoose.Types.ObjectId(params.studentId),
        organization_id: new mongoose.Types.ObjectId(params.organization)
      });
      
      if (student) {
        searchType = 'user_id';
      }
    } catch (error) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Error searching by user ID for update',
        auditId: securityContext.auditId,
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  }

  // If still not found, return error
  if (!student) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Student not found for update by student ID or user ID',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      providedId: params.studentId,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Student not found in this organization. The provided ID was not found as either a student ID or user ID.',
        code: 'STUDENT_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        details: {
          providedId: params.studentId,
          searchedBy: ['student_id', 'user_id'],
          organizationId: params.organization
        }
      }
    }, { status: 404 });
  }

  // Additional access control for students - they can only update their own record
  if (securityContext.user.role === 'student') {
    if (!student.user_id || student.user_id.toString() !== securityContext.user.id) {
      return NextResponse.json({
        error: {
          message: 'Students can only update their own records',
          code: 'INSUFFICIENT_PERMISSIONS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 403 });
    }
  }

  // Parse request body
  const body = await request.json();

  // Update student fields
  if (body.contact_email) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.contact_email)) {
      return NextResponse.json({
        error: {
          message: 'Invalid email format',
          code: 'INVALID_EMAIL_FORMAT',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
    student.contact_email = body.contact_email.toLowerCase();
  }
  if (body.phone) student.phone = body.phone;
  if (body.certifications) student.certifications = body.certifications;
  if (body.license_number) student.license_number = body.license_number;
  if (body.emergency_contact) student.emergency_contact = body.emergency_contact;
  if (body.enrollmentDate) student.enrollmentDate = new Date(body.enrollmentDate);
  if (body.program) student.program = body.program;
  if (body.status) student.status = body.status;
  if (body.stage) student.stage = body.stage;
  if (body.nextMilestone) student.nextMilestone = body.nextMilestone;
  if (body.notes) student.notes = body.notes;
  if (body.progress) student.progress = body.progress;
  
  // Handle studentNotes separately to remove temporary IDs
  if (body.studentNotes) {
    student.studentNotes = body.studentNotes.map(note => {
      // Remove temporary IDs (those that don't match MongoDB ObjectId format)
      const { _id, ...noteWithoutId } = note;
      // Only include _id if it's a valid MongoDB ObjectId
      if (_id && /^[0-9a-fA-F]{24}$/.test(_id)) {
        return { ...noteWithoutId, _id };
      }
      return noteWithoutId;
    });
  }

  // Save the updated student
  await student.save();

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Student updated successfully',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    studentId: student._id.toString(),
    userId: student.user_id?.toString(),
    searchType: searchType,
    providedId: params.studentId,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Student updated successfully',
    data: { student: student.toObject() },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString(),
    searchInfo: {
      providedId: params.studentId,
      foundBy: searchType,
      studentId: student._id.toString(),
      userId: student.user_id?.toString()
    }
  });
}, STUDENT_MODIFY_SECURITY_CONFIG);

// DELETE handler to delete a student
export const DELETE = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string, studentId: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing student deletion request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    studentId: params.studentId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate that the provided ID is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(params.studentId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid ID format - must be a valid ObjectId',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  let student: any = null;
  let searchType = '';

  // First, try to find the student by student ID
  try {
    student = await mongoose.model('Student').findOne({
      _id: new mongoose.Types.ObjectId(params.studentId),
      organization_id: new mongoose.Types.ObjectId(params.organization)
    });
    
    if (student) {
      searchType = 'student_id';
    }
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Error searching by student ID for deletion',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
  }

  // If not found by student ID, try to find by user ID
  if (!student) {
    try {
      student = await mongoose.model('Student').findOne({
        user_id: new mongoose.Types.ObjectId(params.studentId),
        organization_id: new mongoose.Types.ObjectId(params.organization)
      });
      
      if (student) {
        searchType = 'user_id';
      }
    } catch (error) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Error searching by user ID for deletion',
        auditId: securityContext.auditId,
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  }

  // If still not found, return error
  if (!student) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Student not found for deletion by student ID or user ID',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      providedId: params.studentId,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Student not found in this organization. The provided ID was not found as either a student ID or user ID.',
        code: 'STUDENT_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        details: {
          providedId: params.studentId,
          searchedBy: ['student_id', 'user_id'],
          organizationId: params.organization
        }
      }
    }, { status: 404 });
  }

  // Store student info before deletion for logging
  const studentIdToDelete = student._id.toString();
  const userIdToDelete = student.user_id?.toString();

  await student.deleteOne();

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Student deleted successfully',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    studentId: studentIdToDelete,
    userId: userIdToDelete,
    searchType: searchType,
    providedId: params.studentId,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Student deleted successfully',
    data: { student_id: studentIdToDelete },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString(),
    searchInfo: {
      providedId: params.studentId,
      foundBy: searchType,
      studentId: studentIdToDelete,
      userId: userIdToDelete
    }
  });
}, STUDENT_DELETE_SECURITY_CONFIG); 