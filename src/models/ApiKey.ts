import mongoose, { Document, Model, Schema } from 'mongoose';
import { ObjectId } from 'mongodb';

export const API_KEYS_COLLECTION = 'api_keys';

export interface IApiKey extends Document {
  user: ObjectId;
  label: string;
  key: string;
  lastSix: string;
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

const ApiKeySchema = new Schema<IApiKey>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  label: { type: String, required: true },
  key: { type: String, required: true },
  lastSix: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  lastUsedAt: { type: Date }
});

// Create indexes
ApiKeySchema.index({ user: 1 });
ApiKeySchema.index({ key: 1 }, { unique: true });
ApiKeySchema.index({ isActive: 1 });

export function createApiKeyDocument(
  userId: string,
  label: string,
  key: string,
  expiresAt?: Date
): Partial<IApiKey> {
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

// Export the model
export const ApiKey: Model<IApiKey> = mongoose.models.ApiKey || mongoose.model<IApiKey>('ApiKey', ApiKeySchema); 