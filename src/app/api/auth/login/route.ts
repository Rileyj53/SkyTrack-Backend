import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { comparePasswords } from '@/lib/auth';
import { generateToken } from '@/lib/jwt';
import { generateCSRFToken } from '@/lib/csrf';
import { User } from '@/models/User';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  try {
  const { email, password, token } = await request.json();

  // Validate input
  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required' },
      { status: 400 }
    );
  }

  await connectDB();
  const db = mongoose.connection;
  const users = db.collection('users');

  // Find user by email
  const user = await users.findOne({ email });
  if (!user) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  // Verify password
  const isValidPassword = await comparePasswords(password, user.password);
  if (!isValidPassword) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  // Check if MFA is required - MFA should be required on EVERY login when enabled
  if (user.mfaEnabled) {
    // If no token provided, return MFA required response
    if (!token) {
      return NextResponse.json(
        { 
          message: 'MFA verification required',
          requiresMFA: true 
        },
        { status: 401 }
      );
    }

    // Verify MFA token using the User model method
    if (!user.mfaSecret) {
      return NextResponse.json(
        { error: 'MFA secret not found' },
        { status: 500 }
      );
    }

    // Get the user document to use the verifyMFAToken method
    const userDoc = await User.findById(user._id).select('+mfaSecret +mfaBackupCodes');
    if (!userDoc) {
      return NextResponse.json(
        { error: 'User document not found' },
        { status: 500 }
      );
    }

    // Verify the MFA token
    const isValidToken = await userDoc.verifyMFAToken(token);
    if (!isValidToken) {
      return NextResponse.json(
        { error: 'Invalid MFA token' },
        { status: 401 }
    );
    }
  }

  // Generate JWT token
  const jwtToken = await generateToken(user);

  // Generate new CSRF token
  const csrfToken = generateCSRFToken();

  // Create response
  const response = NextResponse.json({
    message: 'Login successful',
    token: jwtToken,
    csrfToken: csrfToken.token
  });

  // Set JWT token cookie
  response.cookies.set('token', jwtToken, {
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
    // Handle errors manually since we're not using createAPIHandler
    console.error('Login error:', error);
    
    if (error instanceof Error) {
      // Handle known error types
      if (error.message.includes('BadRequest')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: error.message },
          { status: 401 }
        );
      }
      if (error.message.includes('InternalServerError')) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }
    
    // Default error response
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}