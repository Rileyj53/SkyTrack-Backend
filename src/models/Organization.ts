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
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_subscription_item_id: string;
  payment_status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';
  current_billing_cycle_start?: Date;
  current_billing_cycle_end?: Date;
  last_usage_report_date?: Date;

  billing_notes?: string;
}

// Define the School document interface
export interface SchoolDocument extends Document {
  name: string;
  type: 'school' | 'club';
  address: Address;
  airport?: string;
  phone?: string;
  email?: string;
  website?: string;
  payment_info?: PaymentInfo;
  admins?: mongoose.Types.ObjectId[];
  instructors?: mongoose.Types.ObjectId[];
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
    type: {
      type: String,
      required: true,
      enum: ['school', 'club'],
      default: 'school',
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
    admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    instructors: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    payment_info: {
      type: {
        stripe_customer_id: { type: String, default: null },
        stripe_subscription_id: { type: String, default: null },
        stripe_subscription_item_id: { type: String, default: null }, 
        last_usage_report_date: { type: Date, default: null },
        current_billing_cycle_start: { type: Date, default: null },
        current_billing_cycle_end: { type: Date, default: null },
        payment_status: { type: String, default: 'active' }, 
        billing_notes: { type: String, default: null } 
      },
      default: null
    }
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

// Create and export the model
export const School: Model<SchoolDocument> = mongoose.models.School || mongoose.model<SchoolDocument>('School', SchoolSchema); 