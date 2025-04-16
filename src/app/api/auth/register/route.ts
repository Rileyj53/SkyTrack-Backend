import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db';
import { User } from '../../../../models/User';
import { generateToken } from '../../../../lib/jwt';
import { hashPassword } from '../../../../lib/auth';
import { generateCSRFToken } from '../../../../lib/csrf';
import { validateApiKey } from '@/middleware/apiKeyAuth';

// Password validation function
function validatePassword(password: string): boolean {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumbers &&
    hasSpecialChar
  );
}

export async function POST(req: NextRequest) {
  try {
    // Validate API key first
    const authResult = await validateApiKey(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    await connectDB();

    const { email, password, role = 'student', school_id, pilot_id } = await req.json();

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate password
    if (!validatePassword(password)) {
      return NextResponse.json(
        {
          error: 'Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters',
        },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['sys_admin', 'school_admin', 'instructor', 'student'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role specified' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // Hash password
    console.log('Hashing password for registration...');
    const hashedPassword = await hashPassword(password);
    console.log('Password hashed successfully');

    // Create user data object with defaults
    const userData = {
      email,
      password: hashedPassword,
      role,
      school_id,
      pilot_id,
      isActive: true,
      failedLoginAttempts: 0,
      mfaEnabled: false,
      mfaVerified: false,
      mfaBackupCodes: [],
      apiKeys: [],
      emailVerified: true
    };
    
    console.log('Creating user with data:', JSON.stringify(userData, null, 2));

    // Create new user
    const user = await User.create(userData);

    // Generate JWT token
    const token = generateToken({
      _id: user._id,
      email: user.email,
      role: user.role
    });

    // Generate CSRF token
    const csrfToken = generateCSRFToken();

    // Create response
    const response = NextResponse.json({
      message: 'User registered successfully',
      token: token,
      csrfToken
    });

    // Set HTTP-only cookie with JWT token
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    // Set CSRF token cookie
    response.cookies.set('csrf-token', csrfToken.token, {
      httpOnly: false, // Allow JavaScript to read this cookie
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: Math.floor((csrfToken.expires - Date.now()) / 1000)
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 