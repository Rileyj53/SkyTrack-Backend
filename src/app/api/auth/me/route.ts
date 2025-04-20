import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, authenticateCSRF } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { User, School, Student, Instructor } from '@/models';
import { verifyToken } from '@/lib/jwt';
import { validateCSRFToken } from '@/lib/csrf';

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = authenticateRequest(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message || 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Log CSRF token information for debugging
    const csrfToken = request.headers.get('X-CSRF-Token');
    const csrfCookie = request.cookies.get('csrf-token')?.value;
    
    console.log('CSRF Token from header:', csrfToken);
    console.log('CSRF Token from cookie:', csrfCookie);
    console.log('All cookies:', request.cookies.getAll());
    
    // Manually validate CSRF token since the cookie name is different
    if (!csrfToken || !csrfCookie) {
      return NextResponse.json(
        { error: 'CSRF token missing' },
        { status: 403 }
      );
    }
    
    const isValid = validateCSRFToken(csrfToken, csrfCookie);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    // Connect to the database
    await connectDB();
    
    // Get the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 401 }
      );
    }
    
    // Decode the token to get all IDs
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    // Log the decoded token to see what fields are available
    console.log('Decoded token:', JSON.stringify(decoded, null, 2));
    
    // Extract IDs from the token
    const userId = decoded.userId;
    const schoolId = decoded.school_id;
    const studentId = decoded.student_id;
    const instructorId = decoded.instructor_id;
    
    console.log('Extracted IDs:', { userId, schoolId, studentId, instructorId });
    
    // Find the user
    const user = await User.findById(userId).lean();
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Get the school information if we have a school ID
    let school = null;
    if (schoolId) {
      school = await School.findById(schoolId).lean();
    }
    
    // Get the student or instructor information if we have their ID
    let student = null;
    let instructor = null;
    if (studentId) {
      student = await (Student as any).findById(studentId).lean();
    }
    if (instructorId) {
      instructor = await (Instructor as any).findById(instructorId).lean();
    }
    
    // Remove null values and mfaBackupCodes from user object
    const cleanUser = Object.fromEntries(
      Object.entries(user)
        .filter(([key, value]) => value !== null && key !== 'mfaBackupCodes')
    );
    
    // Return the user data with school and role-specific information
    return NextResponse.json({
      user: {
        ...cleanUser,
        school: school || null,
        student: student || null,
        instructor: instructor || null
      }
    });
    
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 