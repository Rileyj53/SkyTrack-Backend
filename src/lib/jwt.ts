import jwt from 'jsonwebtoken';
import { UserDocument } from '../models/User';
import { User } from '../models/User';
import { connectDB } from './db';
import Student from '../models/Student';
import Instructor from '../models/Instructor';

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '1d';

// Define the token payload interface
export interface TokenPayload {
  userId: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  iat?: number;
  exp?: number;
  mfaPending?: boolean;
  _id?: string;
  school_id?: string | null;
  student_id?: string | null;
  instructor_id?: string | null;
}

// Generate a JWT token
export const generateToken = async (user: Partial<UserDocument> | UserDocument) => {
  // Ensure we have a valid user ID
  const userId = (user as any).userId || (user as any)._id?.toString() || '';
  
  // Connect to the database if not already connected
  await connectDB();
  
  // If we don't have complete user data, fetch it from the database
  let userData = user;
  if (!user.first_name || !user.last_name) {
    try {
      const fullUser = await User.findById(userId);
      if (fullUser) {
        userData = fullUser;
      }
    } catch (error) {
      console.error('Error fetching user data for token generation:', error);
    }
  }
  
  let schoolId = userData.school_id?.toString() || null;
  
  // Search for student and instructor records associated with this user
  let studentId = null;
  let instructorId = null;
  
  try {
    // Find student record if it exists
    const student = await (Student as any).findOne({ user_id: userId });
    if (student) {
      studentId = student._id.toString();
    }
    
    // Find instructor record if it exists
    const instructor = await (Instructor as any).findOne({ user_id: userId });
    if (instructor) {
      instructorId = instructor._id.toString();
    }
  } catch (error) {
    console.error('Error finding student/instructor records:', error);
    // Continue without the IDs if there's an error
  }
  
  const payload: TokenPayload = {
    userId,
    email: userData.email || '',
    first_name: userData.first_name || '',
    last_name: userData.last_name || '',
    role: userData.role || 'user',
    school_id: schoolId,
    student_id: studentId,
    instructor_id: instructorId
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Verify a JWT token
export const verifyToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
};

// Decode a JWT token without verification
export function decodeToken(token: string): any {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.error(JSON.stringify({
      type: 'jwt_decode_error',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    return null;
  }
}

// Check if a token is expired
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return true;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
}

export async function getUserFromToken(token: string) {
  const decoded = verifyToken(token);
  if (!decoded) return null;

  const user = await User.findById(decoded.userId);
  return user;
} 