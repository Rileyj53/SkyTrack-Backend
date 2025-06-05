import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { comparePasswords } from '@/lib/auth';
import { generateToken } from '@/lib/jwt';
import { createAPIHandler } from '@/lib/apiHandler';
import { Errors } from '@/lib/errors';
import { generateCSRFToken } from '@/lib/csrf';
import { User } from '@/models/User';
import mongoose from 'mongoose';

export const POST = createAPIHandler(async (request: NextRequest) => {
  const { email, password, token } = await request.json();

  // Validate input
  if (!email || !password) {
    throw Errors.BadRequest('Email and password are required');
  }

  await connectDB();
  const db = mongoose.connection;
  const users = db.collection('users');

  // Find user by email
  const user = await users.findOne({ email });
  if (!user) {
    throw Errors.Unauthorized('Invalid email or password');
  }

  // Verify password
  const isValidPassword = await comparePasswords(password, user.password);
  if (!isValidPassword) {
    throw Errors.Unauthorized('Invalid email or password');
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
      throw Errors.InternalServerError('MFA secret not found');
    }

    // Get the user document to use the verifyMFAToken method
    const userDoc = await User.findById(user._id).select('+mfaSecret +mfaBackupCodes');
    if (!userDoc) {
      throw Errors.InternalServerError('User document not found');
    }

    // Verify the MFA token
    const isValidToken = await userDoc.verifyMFAToken(token);
    if (!isValidToken) {
      throw Errors.Unauthorized('Invalid MFA token');
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
}); 