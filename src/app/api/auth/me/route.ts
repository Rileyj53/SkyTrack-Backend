import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { User, School, Student, Instructor } from '@/models';

// Security configuration for user profile endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true, // Authentication required
  requireApiKey: true, // API key required
  requireCSRF: true, // CSRF protection required
  allowedRoles: ['sys_admin', 'school_admin', 'instructor', 'student'], // All authenticated users
  requireSchoolAccess: false, // User can access their own profile regardless of school
  enableFraudDetection: true, // Monitor profile access patterns
  enableAdvancedAudit: true, // Track profile access
  dataClassification: 'confidential', // Contains personal information
  rateLimiting: {
    maxRequests: 100, // Reasonable rate limit for profile access
    windowMs: 60000, // 1 minute window
    slidingWindow: true
  },
  maxRequestSize: 1024 // 1KB max for profile requests
};

export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Structured logging for Vercel
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'User profile request initiated',
    auditId: securityContext.auditId,
    userId: securityContext.user?.id,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'GET /api/auth/me'
  }));

  // Check risk score - monitor for suspicious profile access
  if (securityContext.riskScore > 85) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk profile access detected',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      riskScore: securityContext.riskScore,
      fraudFlags: securityContext.fraudFlags,
      timestamp: new Date().toISOString()
    }));
  }

  // Establish database connection with retry logic
  await connectDB();

  try {
    // Extract user information from security context
    const userId = securityContext.user?.id;
    const schoolId = securityContext.user?.school_id;
    const studentId = securityContext.user?.student_id;
    const instructorId = securityContext.user?.instructor_id;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Fetching user profile data',
      auditId: securityContext.auditId,
      userId: userId,
      hasSchoolId: !!schoolId,
      hasStudentId: !!studentId,
      hasInstructorId: !!instructorId,
      timestamp: new Date().toISOString()
    }));

    // Find the user
    const user = await User.findById(userId).lean();
    
    if (!user) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'User profile not found',
        auditId: securityContext.auditId,
        userId: userId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    // Fetch related data in parallel for better performance
    const dataFetches = [];
    
    // Get school information if available
    if (schoolId) {
      dataFetches.push(
        School.findById(schoolId).lean().then(school => ({ school })).catch(() => ({ school: null }))
      );
    } else {
      dataFetches.push(Promise.resolve({ school: null }));
    }
    
    // Get student information if available
    if (studentId) {
      dataFetches.push(
        (Student as any).findById(studentId).lean().then(student => ({ student })).catch(() => ({ student: null }))
      );
    } else {
      dataFetches.push(Promise.resolve({ student: null }));
    }
    
    // Get instructor information if available
    if (instructorId) {
      dataFetches.push(
        (Instructor as any).findById(instructorId).lean().then(instructor => ({ instructor })).catch(() => ({ instructor: null }))
      );
    } else {
      dataFetches.push(Promise.resolve({ instructor: null }));
    }

    // Wait for all data fetches to complete
    const [schoolData, studentData, instructorData] = await Promise.all(dataFetches);

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Related data fetched successfully',
      auditId: securityContext.auditId,
      userId: userId,
      hasSchool: !!schoolData.school,
      hasStudent: !!studentData.student,
      hasInstructor: !!instructorData.instructor,
      timestamp: new Date().toISOString()
    }));

    // Clean user object - remove sensitive fields and null values
    const cleanUser = Object.fromEntries(
      Object.entries(user)
        .filter(([key, value]) => {
          // Remove sensitive and null fields
          const sensitiveFields = ['password', 'mfaSecret', 'mfaBackupCodes', 'resetToken', 'resetTokenExpiration', 'magicToken', 'magicTokenExpiration', 'magicCode'];
          return value !== null && !sensitiveFields.includes(key);
        })
    );

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'User profile retrieved successfully',
      auditId: securityContext.auditId,
      userId: userId,
      role: user.role,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    // Return the user data with related information
    return NextResponse.json({
      success: true,
      data: {
        user: {
          ...cleanUser,
          school: schoolData.school || null,
          student: studentData.student || null,
          instructor: instructorData.instructor || null
        }
      },
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      securityContext: {
        sessionId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'AES-256'
      }
    });

  } catch (dbError) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Database error while fetching user profile',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      error: dbError.message,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Failed to retrieve user profile',
        code: 'DATABASE_ERROR',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}, SECURITY_CONFIG); 