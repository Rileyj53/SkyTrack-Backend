import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { generateToken, verifyToken } from './jwt';
import { generateCSRFToken, validateCSRFToken } from './csrf';
import { User } from '../models/User';

const SALT_ROUNDS = 10;

export const hashPassword = async (password: string): Promise<string> => {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  return hashedPassword;
};

export const comparePasswords = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

export function validatePassword(password: string): boolean {
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

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function authenticateRequest(request: NextRequest) {
  try {
    // Get the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return { success: false, message: 'No token provided' };
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return { success: false, message: 'Invalid token format' };
    }

    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded) {
      return { success: false, message: 'Invalid token' };
    }

    return { success: true, userId: decoded.userId };
  } catch (error) {
    console.error('Request authentication error');
    return { success: false, message: 'Authentication failed' };
  }
}

export function authenticateCSRF(request: NextRequest) {
  try {
    // Get the CSRF token from the header
    const csrfToken = request.headers.get('X-CSRF-Token');
    if (!csrfToken) {
      return { success: false, message: 'No CSRF token provided' };
    }
    
    // Get the stored CSRF token from the cookie
    const storedToken = request.cookies.get('csrf_token')?.value;
    if (!storedToken) {
      return { success: false, message: 'No stored CSRF token' };
    }
    
    // Verify the CSRF token
    const isValid = validateCSRFToken(csrfToken, storedToken);
    if (!isValid) {
      return { success: false, message: 'Invalid CSRF token' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('CSRF authentication error');
    return { success: false, message: 'CSRF authentication failed' };
  }
}

export function generateVerificationToken(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
} 