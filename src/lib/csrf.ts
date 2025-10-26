import { randomBytes, createHmac } from 'crypto';

// CSRF secret from environment variables
const CSRF_SECRET = process.env.CSRF_SECRET;

if (!CSRF_SECRET) {
  throw new Error('CSRF_SECRET environment variable is required');
}

// Token expiration time in milliseconds (15 minutes)
const TOKEN_EXPIRATION = 15 * 60 * 1000;

interface CSRFToken {
  token: string;
  expires: number;
}

const TOKEN_LENGTH = 32;
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Generate a CSRF token
export function generateCSRFToken(): CSRFToken {
  const token = randomBytes(TOKEN_LENGTH).toString('hex');
  const expires = Date.now() + TOKEN_EXPIRY;
  
  return {
    token,
    expires
  };
}

// Verify a CSRF token
export function validateCSRFToken(token: string, storedToken: string): boolean {
  try {
    // Compare tokens using timing-safe comparison
    return timingSafeEqual(token, storedToken);
  } catch (error) {
    console.error('Error validating CSRF token:', error);
    return false;
  }
}

// Timing-safe string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

// Hash a CSRF token for storage
export function hashCSRFToken(token: CSRFToken): string {
  // For simplicity, just stringify the token object
  // In a production environment, you would use a proper hashing function
  return JSON.stringify(token);
}

// Verify a hashed CSRF token
export function verifyHashedCSRFToken(token: string, hashedToken: string): boolean {
  try {
    const parsedHashedToken = JSON.parse(hashedToken) as CSRFToken;
    
    // Check if token has expired
    if (Date.now() > parsedHashedToken.expires) {
      return false;
    }
    
    // Compare the actual token
    return token === parsedHashedToken.token;
  } catch (error) {
    return false;
  }
} 