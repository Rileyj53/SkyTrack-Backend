import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
}

// Algorithm constants
const AES_256_CBC = 'aes-256-cbc';
const AES_256_GCM = 'aes-256-gcm';
const IV_LENGTH_CBC = 16;
const IV_LENGTH_GCM = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * AES-256-CBC encryption (standard, no authentication)
 * Use for general data encryption where authentication is handled separately
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH_CBC);
  const cipher = crypto.createCipheriv(AES_256_CBC, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * AES-256-CBC decryption
 */
export function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift() || '', 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(AES_256_CBC, Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

/**
 * AES-256-GCM encryption with authentication (recommended for sensitive data)
 * Use for API keys, tokens, and other sensitive data that needs integrity protection
 */
export function encryptSecure(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH_GCM);
  const cipher = crypto.createCipheriv(AES_256_GCM, Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV, encrypted text, and auth tag
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * AES-256-GCM decryption with authentication
 */
export function decryptSecure(encryptedData: string): string {
  const [ivHex, encryptedText, authTagHex] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(AES_256_GCM, Buffer.from(ENCRYPTION_KEY), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Legacy aliases for backward compatibility
export const encryptKey = encryptSecure;
export const decryptKey = decryptSecure; 