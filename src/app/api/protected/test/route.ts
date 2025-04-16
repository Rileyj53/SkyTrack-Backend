import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/middleware/apiKeyAuth';

export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId, apiKeyDoc } = authResult;

    // Return success response
    return NextResponse.json({
      message: 'API key validation successful',
      userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API key validation error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
} 