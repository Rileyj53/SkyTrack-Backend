import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { validateApiKey } from '@/middleware/apiKeyAuth';

// Connect to MongoDB
connectDB();

export async function GET(request: NextRequest) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get user from the validated API key result
    const userId = authResult.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return success response with debug info
    return NextResponse.json({
      message: 'API key is valid',
      userId: user._id,
      email: user.email,
      userRole: user.role,
      isActive: user.isActive,
      timestamp: new Date().toISOString(),
      debugInfo: {
        apiKeyValidation: 'successful',
        userLookup: 'successful',
        endpoint: '/api/debug/test-api-key'
      }
    });
  } catch (error) {
    console.error('Test API key error:', error);
    return NextResponse.json(
      { error: 'Error testing API key' },
      { status: 500 }
    );
  }
} 