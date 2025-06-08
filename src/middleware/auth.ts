import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '../lib/jwt';

// Middleware to authenticate requests
export const authenticateRequest = async (req: NextRequest): Promise<NextResponse | null> => {
  try {
    // Get JWT token from either Authorization header or cookie
    let token = req.headers.get('Authorization')?.split(' ')[1];
    
    // If no token in header, check cookies
    if (!token) {
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [name, value] = cookie.trim().split('=');
          acc[name] = value;
          return acc;
        }, {} as Record<string, string>);
        
        // Check common cookie names for JWT
        token = cookies['token'] || cookies['jwt'] || cookies['auth-token'];
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication token is required' },
        { status: 401 }
      );
    }
    
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