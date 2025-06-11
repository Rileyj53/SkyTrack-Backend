import mongoose, { Document, Model, Schema } from 'mongoose';

// Define the SchoolBillingUsage document interface
export interface SchoolBillingUsageDocument extends Document {
  school_id: mongoose.Types.ObjectId;
  month: string; // "YYYY-MM" format
  total_transactions: number;
  stripe_transactions: number;
  external_transactions: number; // derived = total - stripe
  last_updated: Date;
  billed: boolean; // marked true once charge is sent to Stripe
  stripe_invoice_id?: string; // set after billing
  createdAt: Date;
  updatedAt: Date;
}

// Create the schema
const SchoolBillingUsageSchema = new Schema<SchoolBillingUsageDocument>(
  {
    school_id: {
      type: Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    month: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/, // Validates "YYYY-MM" format
    },
    total_transactions: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    stripe_transactions: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    external_transactions: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    last_updated: {
      type: Date,
      required: true,
      default: Date.now,
    },
    billed: {
      type: Boolean,
      required: true,
      default: false,
    },
    stripe_invoice_id: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

// Create compound index for school_id and month (unique combination)
SchoolBillingUsageSchema.index({ school_id: 1, month: 1 }, { unique: true });

// Virtual for external_transactions (auto-calculated)
SchoolBillingUsageSchema.virtual('calculated_external_transactions').get(function() {
  return this.total_transactions - this.stripe_transactions;
});

// Pre-save middleware to ensure external_transactions is calculated correctly
SchoolBillingUsageSchema.pre('save', function(next) {
  this.external_transactions = this.total_transactions - this.stripe_transactions;
  this.last_updated = new Date();
  next();
});

// Create and export the model
export const SchoolBillingUsage: Model<SchoolBillingUsageDocument> = 
  mongoose.models.SchoolBillingUsage || 
  mongoose.model<SchoolBillingUsageDocument>('SchoolBillingUsage', SchoolBillingUsageSchema); 