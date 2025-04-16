import mongoose, { Document, Model, Schema } from 'mongoose';

// Define interfaces for nested objects
interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

interface PaymentInfo {
  subscription_plan?: string;
  billing_cycle?: string;
  next_billing_date?: Date;
  payment_status?: string;
  stripe_customer_id?: string;
}

// Define the School document interface
export interface SchoolDocument extends Document {
  name: string;
  address: Address;
  airport?: string;
  phone?: string;
  email?: string;
  website?: string;
  payment_info?: PaymentInfo;
  createdAt: Date;
  updatedAt: Date;
}

// Create the schema
const SchoolSchema = new Schema<SchoolDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    address: {
      street: { type: String, default: null },
      city: { type: String, default: null },
      state: { type: String, default: null },
      zip: { type: String, default: null },
      country: { type: String, default: null },
    },
    airport: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      default: null,
    },
    website: {
      type: String,
      default: null,
    },
    payment_info: {
      type: {
        subscription_plan: { type: String, default: null },
        billing_cycle: { type: String, default: null },
        next_billing_date: { type: Date, default: null },
        payment_status: { type: String, default: null },
        stripe_customer_id: { type: String, default: null },
      },
      default: null,
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

// Create and export the model
export const School: Model<SchoolDocument> = mongoose.models.School || mongoose.model<SchoolDocument>('School', SchoolSchema); 