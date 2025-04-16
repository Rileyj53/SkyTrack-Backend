import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { School, SchoolDocument } from '@/models/School';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import mongoose from 'mongoose';
import { User } from '@/models/User';

// Connect to MongoDB
connectDB();

// GET /api/schools - List all schools
export async function GET(request: NextRequest) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get user from token
    const auth = authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has sys_admin role
    const user = await User.findById(auth.userId);
    if (!user || user.role !== 'sys_admin') {
      return NextResponse.json(
        { error: 'Only system administrators can list all schools' },
        { status: 403 }
      );
    }

    // Find all schools
    const schools = await School.find({}).select('-payment_info.stripe_customer_id');
    
    return NextResponse.json({
      schools
    });
  } catch (error) {
    console.error('Error listing schools:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/schools - Create a new school
export async function POST(request: NextRequest) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get user from token
    const auth = authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    const user = await User.findById(auth.userId);
    if (!user || (user.role !== 'sys_admin' && user.role !== 'school_admin')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'School name is required' },
        { status: 400 }
      );
    }

    // Check if school with same name already exists
    const existingSchool = await School.findOne({ name: body.name });
    if (existingSchool) {
      return NextResponse.json(
        { error: 'School with this name already exists' },
        { status: 400 }
      );
    }

    // Create new school
    const school = await School.create(body);
    
    return NextResponse.json({
      message: 'School created successfully',
      school
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating school:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 