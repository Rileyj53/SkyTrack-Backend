import jwt from 'jsonwebtoken';
import { UserDocument } from '../models/User';
import { User } from '../models/User';

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '1d';

// Define the token payload interface
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  mfaPending?: boolean;
  _id?: string;
}

// Generate a JWT token
export const generateToken = (user: Partial<UserDocument> | UserDocument) => {
  const payload: TokenPayload = {
    userId: (user as any).userId || (user as any)._id?.toString() || '',
    email: user.email || '',
    role: user.role || 'user'
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