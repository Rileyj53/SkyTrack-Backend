import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { authenticateRequest } from '@/lib/auth';
import { validateApiKey } from '@/middleware/apiKeyAuth';

// Specify Node.js runtime
export const runtime = 'nodejs';

// Connect to MongoDB
connectDB();

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

    // Find user by ID from token
    const userId = auth.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return protected data
    return NextResponse.json({
      message: 'Protected data retrieved successfully',
      userId: user._id,
      email: user.email
    });
  } catch (error) {
    console.error('Protected route error:', error);
    return NextResponse.json(
      { error: 'Error accessing protected data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId, apiKeyDoc } = authResult;

    // Get request body
    const body = await request.json();

    // Return success response with request data
    return NextResponse.json({
      message: 'Data received',
      userId,
      data: body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in protected route:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 