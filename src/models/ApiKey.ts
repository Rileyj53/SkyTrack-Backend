import { ObjectId } from 'mongodb';

export const API_KEYS_COLLECTION = 'api_keys';

export interface IApiKey {
  _id?: ObjectId;
  user: ObjectId;
  label: string;
  key: string;
  lastSix: string;
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

export function createApiKeyDocument(
  userId: string,
  label: string,
  key: string,
  expiresAt?: Date
): IApiKey {
  return {
    user: new ObjectId(userId),
    label,
    key,
    lastSix: key.slice(-6),
    isActive: true,
    createdAt: new Date(),
    expiresAt,
  };
} 