import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { School, SchoolDocument } from '@/models/School';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import mongoose from 'mongoose';
import { User } from '@/models/User';
import { verifyToken } from '@/lib/jwt';

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

    // Get the token from the Authorization header to extract role
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1] || '';
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check if user has sys_admin role
    if (decoded.role !== 'sys_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only system administrators can list all schools' },
        { status: 403 }
      );
    }

    // Find all schools
    const schools = await School.find({}).select('-payment_info.stripe_customer_id');
    
    return NextResponse.json({
      status: 'success',
      data: schools
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