import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, decodeToken, generateToken } from '@/lib/jwt';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { User } from '@/models/User';
import { connectDB } from '@/lib/db';

connectDB();

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { token, action } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'JWT token is required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const result = {
      action: action || 'validate',
      token: {
        provided: token.substring(0, 20) + '...',
        length: token.length
      },
      validation: {},
      decoded: {},
      user: {},
      timing: {}
    };

    // Decode token (without verification)
    try {
      const decoded = decodeToken(token);
      result.decoded = {
        status: 'success',
        header: decoded ? {
          alg: decoded.header?.alg,
          typ: decoded.header?.typ
        } : null,
        payload: decoded ? {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          school_id: decoded.school_id,
          student_id: decoded.student_id,
          instructor_id: decoded.instructor_id,
          iat: decoded.iat,
          exp: decoded.exp,
          issuedAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : null,
          expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
          isExpired: decoded.exp ? Date.now() > (decoded.exp * 1000) : null
        } : null
      };
    } catch (decodeError) {
      result.decoded = {
        status: 'error',
        error: decodeError.message
      };
    }

    // Verify token (with signature validation)
    const verifyStartTime = Date.now();
    try {
      const verified = verifyToken(token);
      result.validation = {
        status: verified ? 'valid' : 'invalid',
        responseTime: Date.now() - verifyStartTime,
        verified: !!verified,
        details: verified || 'Token verification failed'
      };

      // If token is valid, get user information
      if (verified && verified.userId) {
        const userStartTime = Date.now();
        try {
          const user = await User.findById(verified.userId).select('-password -mfaSecret -mfaBackupCodes').lean();
          result.user = {
            status: user ? 'found' : 'not_found',
            responseTime: Date.now() - userStartTime,
            exists: !!user,
            data: user ? {
              _id: user._id,
              email: user.email,
              role: user.role,
              isActive: user.isActive,
              mfaEnabled: user.mfaEnabled,
              emailVerified: user.emailVerified
            } : null
          };
        } catch (userError) {
          result.user = {
            status: 'error',
            error: userError.message,
            responseTime: Date.now() - userStartTime
          };
        }
      }

    } catch (verifyError) {
      result.validation = {
        status: 'error',
        error: verifyError.message,
        responseTime: Date.now() - verifyStartTime
      };
    }

    result.timing = {
      totalResponseTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      message: 'JWT token analysis complete',
      ...result
    });

  } catch (error) {
    console.error('JWT debug endpoint error:', error);
    return NextResponse.json({
      message: 'JWT debug endpoint error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Generate a sample token for testing
    const sampleUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      role: 'student',
      school_id: '507f1f77bcf86cd799439012',
      student_id: '507f1f77bcf86cd799439013'
    };

    const sampleToken = await generateToken(sampleUser);

    return NextResponse.json({
      message: 'JWT debug endpoint information',
      timestamp: new Date().toISOString(),
      sampleToken: {
        token: sampleToken,
        usage: 'Use this sample token to test the POST endpoint',
        note: 'This is a valid token generated for testing purposes'
      },
      usage: {
        endpoint: 'POST /api/debug/jwt',
        requiredFields: ['token'],
        optionalFields: ['action'],
        purpose: 'Analyze and validate JWT tokens',
        examples: {
          validation: 'Test token validity and signature',
          decoding: 'Extract token payload and header information',
          userLookup: 'Find associated user data'
        }
      },
      tokenStructure: {
        header: {
          alg: 'Algorithm used for signing',
          typ: 'Token type (JWT)'
        },
        payload: {
          userId: 'User ID from database',
          email: 'User email address',
          role: 'User role (student, instructor, school_admin, sys_admin)',
          school_id: 'Associated school ID',
          student_id: 'Student ID if applicable',
          instructor_id: 'Instructor ID if applicable',
          iat: 'Issued at timestamp',
          exp: 'Expiration timestamp'
        },
        signature: 'Cryptographic signature for verification'
      }
    });

  } catch (error) {
    console.error('JWT info endpoint error:', error);
    return NextResponse.json({
      message: 'JWT info endpoint error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 