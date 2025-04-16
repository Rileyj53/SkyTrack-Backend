import { NextRequest, NextResponse } from 'next/server';
import { User } from '@/models/User';
import { authenticateRequest } from '@/lib/auth';
import mongoose from 'mongoose';

/**
 * Middleware to check if a user has access to a specific school
 * This middleware should be used for routes that are school-specific
 * 
 * @param req The request object
 * @param schoolId The school ID to check access for
 * @returns NextResponse or null if access is granted
 */
export async function checkSchoolAccess(req: NextRequest, schoolId: string) {
  try {
    // Get the user from the token
    const auth = authenticateRequest(req);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the user from the database
    const user = await User.findById(auth.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Sys admins have access to all schools
    if (user.role === 'sys_admin') {
      return null; // Access granted
    }

    // Check if the user has a school_id and if it matches the requested school
    if (!user.school_id) {
      return NextResponse.json(
        { error: 'User not assigned to any school' },
        { status: 403 }
      );
    }

    // Check if the user's school_id matches the requested school
    if (user.school_id.toString() !== schoolId) {
      return NextResponse.json(
        { error: 'Access denied to this school' },
        { status: 403 }
      );
    }

    // Access granted
    return null;
  } catch (error) {
    console.error('Error checking school access:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Middleware to check if a user can list schools
 * This middleware should be used for routes that list schools
 * 
 * @param req The request object
 * @returns NextResponse or null if access is granted
 */
export async function checkSchoolsListAccess(req: NextRequest) {
  try {
    // Get the user from the token
    const auth = authenticateRequest(req);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the user from the database
    const user = await User.findById(auth.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Sys admins can list all schools
    if (user.role === 'sys_admin') {
      return null; // Access granted
    }

    // School admins can list their own school
    if (user.role === 'school_admin' && user.school_id) {
      return null; // Access granted
    }

    // Other users cannot list schools
    return NextResponse.json(
      { error: 'Access denied to list schools' },
      { status: 403 }
    );
  } catch (error) {
    console.error('Error checking schools list access:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Middleware to check if a user can create schools
 * This middleware should be used for routes that create schools
 * 
 * @param req The request object
 * @returns NextResponse or null if access is granted
 */
export async function checkSchoolCreationAccess(req: NextRequest) {
  try {
    // Get the user from the token
    const auth = authenticateRequest(req);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the user from the database
    const user = await User.findById(auth.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Only sys admins can create schools
    if (user.role !== 'sys_admin') {
      return NextResponse.json(
        { error: 'Access denied to create schools' },
        { status: 403 }
      );
    }

    // Access granted
    return null;
  } catch (error) {
    console.error('Error checking school creation access:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 