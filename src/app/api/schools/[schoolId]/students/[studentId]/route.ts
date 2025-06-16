import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import Student from '@/models/Student';

// Security configuration for individual student operations
const STUDENT_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: false, // GET operations don't need CSRF
  allowedRoles: ['sys_admin', 'school_admin', 'instructor', 'student'],
  requireSchoolAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000,
    slidingWindow: true
  }
};

const STUDENT_MODIFY_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // PUT/DELETE operations need CSRF
  allowedRoles: ['sys_admin', 'school_admin', 'instructor', 'student'],
  requireSchoolAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 50,
    windowMs: 60000,
    slidingWindow: true
  }
};

const STUDENT_DELETE_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  allowedRoles: ['sys_admin', 'school_admin'],
  requireSchoolAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 20,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET handler to get a specific student
export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing student details request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate student ID
  if (!mongoose.Types.ObjectId.isValid(params.studentId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid student ID format',
        code: 'INVALID_STUDENT_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find the student
  const student = await mongoose.model('Student').findOne({
    _id: new mongoose.Types.ObjectId(params.studentId),
    school_id: new mongoose.Types.ObjectId(params.schoolId)
  }).populate('user_id', 'first_name last_name email role').lean();

  if (!student) {
    return NextResponse.json({
      error: {
        message: 'Student not found',
        code: 'STUDENT_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
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
    schoolId: params.schoolId,
    studentId: params.studentId,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Student retrieved successfully',
    data: student,
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, STUDENT_SECURITY_CONFIG);

// PUT handler to update a student
export const PUT = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing student update request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate student ID
  if (!mongoose.Types.ObjectId.isValid(params.studentId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid student ID format',
        code: 'INVALID_STUDENT_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find the student first
  const student = await mongoose.model('Student').findOne({
    _id: new mongoose.Types.ObjectId(params.studentId),
    school_id: new mongoose.Types.ObjectId(params.schoolId)
  });

  if (!student) {
    return NextResponse.json({
      error: {
        message: 'Student not found',
        code: 'STUDENT_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
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
    schoolId: params.schoolId,
    studentId: params.studentId,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Student updated successfully',
    data: { student: student.toObject() },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, STUDENT_MODIFY_SECURITY_CONFIG);

// DELETE handler to delete a student
export const DELETE = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing student deletion request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate student ID
  if (!mongoose.Types.ObjectId.isValid(params.studentId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid student ID format',
        code: 'INVALID_STUDENT_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find and delete the student
  const student = await mongoose.model('Student').findOne({
    _id: new mongoose.Types.ObjectId(params.studentId),
    school_id: new mongoose.Types.ObjectId(params.schoolId)
  });

  if (!student) {
    return NextResponse.json({
      error: {
        message: 'Student not found',
        code: 'STUDENT_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  await student.deleteOne();

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Student deleted successfully',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Student deleted successfully',
    data: { student_id: params.studentId },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, STUDENT_DELETE_SECURITY_CONFIG); 