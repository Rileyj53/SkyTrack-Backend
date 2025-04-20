import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '../lib/jwt';

// Middleware to authenticate requests
export const authenticateRequest = async (req: NextRequest): Promise<NextResponse | null> => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication token is required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }
    
    // Add the user ID to the request for later use
    req.headers.set('X-User-ID', decoded.userId);
    
    return null;
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}; 