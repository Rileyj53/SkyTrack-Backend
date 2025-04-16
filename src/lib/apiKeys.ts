import { connectEdgeDB } from '@/lib/edgeDb';
import { IApiKey, API_KEYS_COLLECTION } from '@/models/ApiKey';
import { ObjectId } from 'mongodb';

/**
 * Generates a new API key with the format: pk_xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx
 * where x is a hexadecimal digit.
 */
export function generateAPIKey(): string {
  // Generate a random string of 32 hex characters
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Format the key with dashes
  return `pk_${result.slice(0, 8)}-${result.slice(8, 16)}-${result.slice(16, 24)}-${result.slice(24, 32)}`;
}

/**
 * Validates if a string matches the API key format.
 */
export function validateAPIKey(key: string): boolean {
  const apiKeyRegex = /^pk_[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}$/;
  return apiKeyRegex.test(key);
}

// Helper function to calculate expiration date
export function calculateExpirationDate(durationValue: number, durationType: string): Date {
  const now = new Date();
  
  switch (durationType) {
    case 'days':
      return new Date(now.setDate(now.getDate() + durationValue));
    case 'weeks':
      return new Date(now.setDate(now.getDate() + durationValue * 7));
    case 'months':
      return new Date(now.setMonth(now.getMonth() + durationValue));
    case 'years':
      return new Date(now.setFullYear(now.getFullYear() + durationValue));
    default:
      return new Date(now.setDate(now.getDate() + 30)); // Default to 30 days
  }
}

// List all API keys for a user
export const listApiKeys = async (userId: string) => {
  // Connect to the database
  const client = await connectEdgeDB();
  const db = client.db();
  
  // Find all API keys for the user
  const apiKeys = await db.collection(API_KEYS_COLLECTION)
    .find({ user: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();
  
  // Return the API keys without the actual key value
  return apiKeys.map(apiKey => ({
    id: apiKey._id,
    label: apiKey.label,
    createdAt: apiKey.createdAt,
    expiresAt: apiKey.expiresAt,
    lastSix: apiKey.lastSix
  }));
};

// Revoke an API key
export const revokeApiKey = async (userId: string, apiKeyId: string): Promise<boolean> => {
  // Connect to the database
  const client = await connectEdgeDB();
  const db = client.db();
  
  // Find the API key
  const apiKey = await db.collection(API_KEYS_COLLECTION).findOne({ 
    _id: new ObjectId(apiKeyId),
    user: new ObjectId(userId)
  });
  
  if (!apiKey) {
    return false;
  }
  
  // Deactivate the API key
  await db.collection(API_KEYS_COLLECTION).updateOne(
    { _id: new ObjectId(apiKeyId) },
    { $set: { isActive: false } }
  );
  
  return true;
};

export async function hashAPIKey(apiKey: string): Promise<string> {
  // Simple hashing function for Edge compatibility
  // In production, you should use a more secure hashing algorithm
  let hash = 0;
  for (let i = 0; i < apiKey.length; i++) {
    const char = apiKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
} 