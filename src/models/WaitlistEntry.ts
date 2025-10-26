import mongoose, { Schema, Document, Model } from 'mongoose';

// Define the WaitlistEntry document interface
export interface WaitlistEntryDocument extends Document {
  email: string;
  submittedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  source?: string; // Track where the signup came from (e.g., 'landing_page', 'marketing', etc.)
  status: 'active' | 'contacted' | 'converted' | 'unsubscribed';
  createdAt: Date;
  updatedAt: Date;
}

// Create the schema
const WaitlistEntrySchema = new Schema<WaitlistEntryDocument>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    submittedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    ipAddress: {
      type: String,
      required: false,
      trim: true
    },
    userAgent: {
      type: String,
      required: false,
      trim: true
    },
    source: {
      type: String,
      required: false,
      trim: true,
      default: 'waitlist_form'
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'contacted', 'converted', 'unsubscribed'],
      default: 'active'
    }
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

// Create indexes for efficient querying (email index is automatically created by unique: true)
WaitlistEntrySchema.index({ status: 1 });
WaitlistEntrySchema.index({ submittedAt: -1 }); // For sorting by submission date

// Create and export the model
export const WaitlistEntry: Model<WaitlistEntryDocument> = 
  mongoose.models.WaitlistEntry || mongoose.model<WaitlistEntryDocument>('WaitlistEntry', WaitlistEntrySchema); 