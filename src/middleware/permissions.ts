import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '../lib/jwt';
import { connectDB } from '../lib/db';
import { School } from '../models/School';
import { User } from '../models/User';
import Student from '../models/Student';
import Instructor from '../models/Instructor';
import Plane from '../models/Plane';
import FlightLog from '../models/FlightLog';
import ScheduleModel from '../models/ScheduleModel';

// Define permission types
export enum Permission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin'
}

// Define resource types
export enum Resource {
  SCHOOL = 'school',
  USER = 'user',
  STUDENT = 'student',
  INSTRUCTOR = 'instructor',
  PLANE = 'plane',
  FLIGHT_LOG = 'flightLog',
  SCHEDULED_FLIGHT = 'scheduledFlight'
}

// Define role permissions
const rolePermissions = {
  sys_admin: {
    [Resource.SCHOOL]: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
    [Resource.USER]: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
    [Resource.STUDENT]: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
    [Resource.INSTRUCTOR]: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
    [Resource.PLANE]: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
    [Resource.FLIGHT_LOG]: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
    [Resource.SCHEDULED_FLIGHT]: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN]
  },
  school_admin: {
    [Resource.SCHOOL]: [Permission.READ],
    [Resource.USER]: [Permission.READ, Permission.WRITE],
    [Resource.STUDENT]: [Permission.READ, Permission.WRITE],
    [Resource.INSTRUCTOR]: [Permission.READ, Permission.WRITE],
    [Resource.PLANE]: [Permission.READ, Permission.WRITE],
    [Resource.FLIGHT_LOG]: [Permission.READ, Permission.WRITE, Permission.DELETE],
    [Resource.SCHEDULED_FLIGHT]: [Permission.READ, Permission.WRITE]
  },
  instructor: {
    [Resource.SCHOOL]: [Permission.READ],
    [Resource.USER]: [Permission.READ],
    [Resource.STUDENT]: [Permission.READ],
    [Resource.INSTRUCTOR]: [Permission.READ],
    [Resource.PLANE]: [Permission.READ],
    [Resource.FLIGHT_LOG]: [Permission.READ, Permission.WRITE],
    [Resource.SCHEDULED_FLIGHT]: [Permission.READ, Permission.WRITE]
  },
  student: {
    [Resource.SCHOOL]: [Permission.READ],
    [Resource.USER]: [Permission.READ],
    [Resource.STUDENT]: [Permission.READ],
    [Resource.INSTRUCTOR]: [Permission.READ],
    [Resource.PLANE]: [Permission.READ],
    [Resource.FLIGHT_LOG]: [Permission.READ],
    [Resource.SCHEDULED_FLIGHT]: [Permission.READ]
  }
};

// Check if a user has permission for a specific resource
export const hasPermission = (role: string, resource: Resource, permission: Permission): boolean => {
  if (!role || !resource || !permission) return false;
  
  const permissions = rolePermissions[role];
  if (!permissions) return false;
  
  const resourcePermissions = permissions[resource];
  if (!resourcePermissions) return false;
  
  return resourcePermissions.includes(permission);
};

// Middleware to check if user has access to a school
export const checkSchoolAccess = async (req: NextRequest, schoolId: string): Promise<boolean> => {
  const token = req.headers.get('Authorization')?.split(' ')[1];
  if (!token) return false;
  
  const decoded = verifyToken(token);
  if (!decoded) return false;
  
  // System admins have access to all schools
  if (decoded.role === 'sys_admin') return true;
  
  // School admins have access to their school
  if (decoded.role === 'school_admin' && decoded.school_id === schoolId) return true;
  
  // Instructors have access to their school
  if (decoded.role === 'instructor' && decoded.school_id === schoolId) return true;
  
  // Students have access to their school
  if (decoded.role === 'student' && decoded.school_id === schoolId) return true;
  
  return false;
};

// Middleware to check if user has access to a student
export const checkStudentAccess = async (req: NextRequest, studentId: string): Promise<boolean> => {
  const token = req.headers.get('Authorization')?.split(' ')[1];
  if (!token) return false;
  
  const decoded = verifyToken(token);
  if (!decoded) return false;
  
  // System admins have access to all students
  if (decoded.role === 'sys_admin') return true;
  
  // School admins have access to all students in their school
  if (decoded.role === 'school_admin') {
    await connectDB();
    const student = await (Student as any).findById(studentId);
    return student && student.school_id.toString() === decoded.school_id;
  }
  
  // Instructors have access to all students in their school
  if (decoded.role === 'instructor') {
    await connectDB();
    const student = await (Student as any).findById(studentId);
    return student && student.school_id.toString() === decoded.school_id;
  }
  
  // Students have access only to their own data
  if (decoded.role === 'student') {
    return decoded.student_id === studentId;
  }
  
  return false;
};

// Middleware to check if user has access to an instructor
export const checkInstructorAccess = async (req: NextRequest, instructorId: string): Promise<boolean> => {
  const token = req.headers.get('Authorization')?.split(' ')[1];
  if (!token) return false;
  
  const decoded = verifyToken(token);
  if (!decoded) return false;
  
  // System admins have access to all instructors
  if (decoded.role === 'sys_admin') return true;
  
  // School admins have access to all instructors in their school
  if (decoded.role === 'school_admin') {
    await connectDB();
    const instructor = await (Instructor as any).findById(instructorId);
    return instructor && instructor.school_id.toString() === decoded.school_id;
  }
  
  // Instructors have access to all instructors in their school
  if (decoded.role === 'instructor') {
    await connectDB();
    const instructor = await (Instructor as any).findById(instructorId);
    return instructor && instructor.school_id.toString() === decoded.school_id;
  }
  
  // Students have access to all instructors in their school
  if (decoded.role === 'student') {
    await connectDB();
    const instructor = await (Instructor as any).findById(instructorId);
    return instructor && instructor.school_id.toString() === decoded.school_id;
  }
  
  return false;
};

// Middleware to check if user has access to a plane
export const checkPlaneAccess = async (req: NextRequest, planeId: string): Promise<boolean> => {
  const token = req.headers.get('Authorization')?.split(' ')[1];
  if (!token) return false;
  
  const decoded = verifyToken(token);
  if (!decoded) return false;
  
  // System admins have access to all planes
  if (decoded.role === 'sys_admin') return true;
  
  // School admins have access to all planes in their school
  if (decoded.role === 'school_admin') {
    await connectDB();
    const plane = await (Plane as any).findById(planeId);
    return plane && plane.school_id.toString() === decoded.school_id;
  }
  
  // Instructors have access to all planes in their school
  if (decoded.role === 'instructor') {
    await connectDB();
    const plane = await (Plane as any).findById(planeId);
    return plane && plane.school_id.toString() === decoded.school_id;
  }
  
  // Students have access to all planes in their school
  if (decoded.role === 'student') {
    await connectDB();
    const plane = await (Plane as any).findById(planeId);
    return plane && plane.school_id.toString() === decoded.school_id;
  }
  
  return false;
};

// Middleware to check if user has access to a flight log
export const checkFlightLogAccess = async (req: NextRequest, flightLogId: string): Promise<boolean> => {
  const token = req.headers.get('Authorization')?.split(' ')[1];
  if (!token) return false;
  
  const decoded = verifyToken(token);
  if (!decoded) return false;
  
  // System admins have access to all flight logs
  if (decoded.role === 'sys_admin') return true;
  
  // School admins have access to all flight logs in their school
  if (decoded.role === 'school_admin') {
    await connectDB();
    const flightLog = await (FlightLog as any).findById(flightLogId);
    return flightLog && flightLog.school_id.toString() === decoded.school_id;
  }
  
  // Instructors have access to all flight logs in their school
  if (decoded.role === 'instructor') {
    await connectDB();
    const flightLog = await (FlightLog as any).findById(flightLogId);
    return flightLog && flightLog.school_id.toString() === decoded.school_id;
  }
  
  // Students have access only to their own flight logs
  if (decoded.role === 'student') {
    await connectDB();
    const flightLog = await (FlightLog as any).findById(flightLogId);
    return flightLog && flightLog.student_id.toString() === decoded.student_id;
  }
  
  return false;
};

// Middleware to check if user has access to a scheduled flight
export const checkScheduledFlightAccess = async (req: NextRequest, scheduledFlightId: string): Promise<boolean> => {
  const token = req.headers.get('Authorization')?.split(' ')[1];
  if (!token) return false;
  
  const decoded = verifyToken(token);
  if (!decoded) return false;
  
  // System admins have access to all scheduled flights
  if (decoded.role === 'sys_admin') return true;
  
  // School admins have access to all scheduled flights in their school
  if (decoded.role === 'school_admin') {
    await connectDB();
    const scheduledFlight = await (ScheduleModel as any).findById(scheduledFlightId);
    return scheduledFlight && scheduledFlight.school_id.toString() === decoded.school_id;
  }
  
  // Instructors have access to all scheduled flights in their school
  if (decoded.role === 'instructor') {
    await connectDB();
    const scheduledFlight = await (ScheduleModel as any).findById(scheduledFlightId);
    return scheduledFlight && scheduledFlight.school_id.toString() === decoded.school_id;
  }
  
  // Students have access only to their own scheduled flights
  if (decoded.role === 'student') {
    await connectDB();
    const scheduledFlight = await (ScheduleModel as any).findById(scheduledFlightId);
    return scheduledFlight && scheduledFlight.student_id.toString() === decoded.student_id;
  }
  
  return false;
};

// Middleware to check if user has access to a user
export async function checkUserAccess(
  request: NextRequest,
  targetUserId: string
): Promise<boolean> {
  try {
    // Get the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1] || '';
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return false;
    }

    // System admins have access to all users
    if (decoded.role === 'sys_admin') {
      return true;
    }

    // If the user is accessing their own data, they have access
    if (decoded.userId === targetUserId) {
      return true;
    }

    // Get the target user to check their school_id
    const targetUser = await (User as any).findById(targetUserId);
    if (!targetUser) {
      return false;
    }

    // School admins and instructors can access users in their school
    if (decoded.role === 'school_admin' || decoded.role === 'instructor') {
      // Check if both users have school_id and they match
      if (decoded.school_id && targetUser.school_id) {
        return decoded.school_id.toString() === targetUser.school_id.toString();
      }
      return false;
    }

    // Students can only access their own data
    if (decoded.role === 'student') {
      return false;
    }

    // Default to no access
    return false;
  } catch (error) {
    console.error('Error checking user access:', error);
    return false;
  }
}

// Middleware to check if user has permission for a specific resource and action
export const checkPermission = async (
  req: NextRequest, 
  resource: Resource, 
  permission: Permission
): Promise<boolean> => {
  const token = req.headers.get('Authorization')?.split(' ')[1];
  if (!token) return false;
  
  const decoded = verifyToken(token);
  if (!decoded) return false;
  
  return hasPermission(decoded.role, resource, permission);
};

// Middleware to enforce permissions
export const enforcePermission = async (
  req: NextRequest,
  resource: Resource,
  permission: Permission
): Promise<NextResponse | null> => {
  const hasAccess = await checkPermission(req, resource, permission);
  
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'You do not have permission to perform this action' },
      { status: 403 }
    );
  }
  
  return null;
}; 