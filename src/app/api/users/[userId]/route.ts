import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import { User } from '@/models/User';
import { checkUserAccess } from '@/middleware/permissions';

// Connect to MongoDB
connectDB();

// GET /api/users/[userId] - Get user information
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Authenticate the request
    const authError = await authenticateRequest(request);
    if (authError) return authError;

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

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(params.userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Find user by ID - exclude sensitive fields
    const user = await User.findById(params.userId);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to view this user
    const hasAccess = await checkUserAccess(request, params.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Create a safe user object without sensitive data
    const safeUser = {
      _id: user._id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      school_id: user.school_id,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      mfaVerified: user.mfaVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return NextResponse.json({
      user: safeUser
    });
  } catch (error) {
    console.error('Error getting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[userId] - Update user information
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Authenticate the request
    const authError = await authenticateRequest(request);
    if (authError) return authError;

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

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(params.userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Find user by ID
    const user = await User.findById(params.userId);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to update this user
    const hasAccess = await checkUserAccess(request, params.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    
    // Get the fields that can be updated
    const allowedFields = [
      'email',
      'first_name',
      'last_name',
      'role',
      'school_id',
      'isActive',
      'emailVerified',
      'mfaEnabled',
      'mfaVerified'
    ];

    // Filter out fields that are not allowed to be updated
    const updates = Object.keys(body)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = body[key];
        return obj;
      }, {} as any);

    // If email is being changed, check if it already exists
    if (updates.email && updates.email !== user.email) {
      const existingUser = await User.findOne({ email: updates.email });
      if (existingUser) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        );
      }
    }

    // If role is being changed, only sys_admin can change roles
    if (updates.role && updates.role !== user.role && decoded.role !== 'sys_admin') {
      return NextResponse.json(
        { error: 'Only system administrators can change user roles' },
        { status: 403 }
      );
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      params.userId,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    // Create a safe user object without sensitive data
    const safeUser = {
      _id: updatedUser._id,
      email: updatedUser.email,
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      role: updatedUser.role,
      school_id: updatedUser.school_id,
      isActive: updatedUser.isActive,
      emailVerified: updatedUser.emailVerified,
      mfaEnabled: updatedUser.mfaEnabled,
      mfaVerified: updatedUser.mfaVerified,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    };
    
    return NextResponse.json({
      message: 'User updated successfully',
      user: safeUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 