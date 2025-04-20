import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { School } from '@/models/School';
import { User } from '@/models/User';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';

export async function validateMaintenanceAccess(
  request: NextRequest,
  schoolId: string,
  requiredRole: 'sys_admin' | 'school_admin' | 'instructor' | 'student' = 'student'
) {
  try {
    // Ensure database connection
    await connectDB();
    
    // Authenticate user
    const authResult = authenticateRequest(request);
    if (!authResult.success) {
      return { error: authResult.message || 'Authentication failed' };
    }

    // Get user from database using mongoose directly
    const user = await mongoose.connection.db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(authResult.userId) });
    if (!user) {
      return { error: 'User not found' };
    }

    // System admins have full access
    if (user.role === 'sys_admin') {
      return { user };
    }

    // For school-specific access, verify the user belongs to the school
    if (user.role === 'school_admin' || user.role === 'instructor') {
      const school = await School.findById(schoolId);
      if (!school) {
        return { error: 'School not found' };
      }

      // Check if user belongs to the school
      if ((school.admins && school.admins.includes(user._id)) || 
          (school.instructors && school.instructors.includes(user._id))) {
        return { user };
      }
    }

    // If we get here, user doesn't have required access
    return { error: 'Unauthorized access' };
  } catch (error) {
    console.error('Error in validateMaintenanceAccess:', error);
    return { error: 'Internal server error' };
  }
}

// Helper function to check if user has required role
export function hasRequiredRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = {
    'sys_admin': 4,
    'school_admin': 3,
    'instructor': 2,
    'student': 1
  };

  return roleHierarchy[userRole as keyof typeof roleHierarchy] >= roleHierarchy[requiredRole as keyof typeof roleHierarchy];
} 