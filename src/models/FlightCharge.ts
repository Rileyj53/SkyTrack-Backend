import mongoose, { Schema, Document } from 'mongoose';

export interface IFlightCharge extends Document {
  flight_schedule_id: mongoose.Types.ObjectId;
  school_id: mongoose.Types.ObjectId;
  student_id: mongoose.Types.ObjectId;
  plane_id: mongoose.Types.ObjectId;
  instructor_id?: mongoose.Types.ObjectId; // Optional for solo flights
  duration: number; // Flight duration in hours
  rate_type: string; // 'instruction', 'solo', 'aircraft_rental', 'fuel', etc.
  rate_override?: number; // Optional rate override amount
  simulator: boolean; // true for simulator, false for actual aircraft
  amount: number; // Charge amount (can be negative for credits)
  currency: string; // Currency code (USD, EUR, etc.)
  status: 'pending' | 'approved' | 'rejected';
  reason_rejected?: string; // Reason for rejection if status is rejected
  created_by: mongoose.Types.ObjectId; // User who created the charge
  approved_by?: mongoose.Types.ObjectId; // User who approved/rejected the charge
  created_at: Date;
  approved_at?: Date; // When the charge was approved/rejected
  updated_at: Date;
}

const FlightChargeSchema = new Schema<IFlightCharge>({
  flight_schedule_id: {
    type: Schema.Types.ObjectId,
    ref: 'FlightSchedule',
    required: [true, 'Flight schedule ID is required'],
    index: true
  },
  school_id: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required'],
    index: true
  },
  student_id: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required'],
    index: true
  },
  plane_id: {
    type: Schema.Types.ObjectId,
    ref: 'Plane',
    required: [true, 'Plane ID is required'],
    index: true
  },
  instructor_id: {
    type: Schema.Types.ObjectId,
    ref: 'Instructor',
    required: false, // Optional for solo flights
    index: true
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [0, 'Duration cannot be negative']
  },
  rate_type: {
    type: String,
    required: [true, 'Rate type is required'],
    enum: [
      'instruction', 
      'solo', 
      'aircraft_rental', 
      'fuel', 
      'landing_fee', 
      'simulator', 
      'ground_school', 
      'checkride',
      'other'
    ],
    trim: true
  },
  rate_override: {
    type: Number,
    required: false,
    min: [0, 'Rate override cannot be negative']
  },
  simulator: {
    type: Boolean,
    required: [true, 'Simulator flag is required'],
    default: false
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required']
    // Can be negative for credits/refunds
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
    default: 'USD',
    uppercase: true,
    trim: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reason_rejected: {
    type: String,
    required: false,
    trim: true
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required'],
    index: true
  },
  approved_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  approved_at: {
    type: Date,
    required: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Pre-save middleware to handle approval/rejection logic
FlightChargeSchema.pre('save', function(next) {
  // If status is being changed to approved or rejected, set approved_at timestamp
  if ((this.status === 'approved' || this.status === 'rejected') && !this.approved_at) {
    this.approved_at = new Date();
  }
  
  // Clear reason_rejected if status is not rejected
  if (this.status !== 'rejected') {
    this.reason_rejected = undefined;
  }
  
  // Clear approved_by and approved_at if status is pending
  if (this.status === 'pending') {
    this.approved_by = undefined;
    this.approved_at = undefined;
  }
  
  next();
});

// Pre-update middleware for approval/rejection logic
FlightChargeSchema.pre(['findOneAndUpdate', 'updateOne'], function(next) {
  const update = this.getUpdate() as any;
  if (update.$set && update.$set.status) {
    if ((update.$set.status === 'approved' || update.$set.status === 'rejected') && !update.$set.approved_at) {
      update.$set.approved_at = new Date();
    }
    
    if (update.$set.status !== 'rejected') {
      update.$set.reason_rejected = undefined;
    }
    
    if (update.$set.status === 'pending') {
      update.$set.approved_by = undefined;
      update.$set.approved_at = undefined;
    }
  }
  next();
});

// Create compound indexes for efficient querying
FlightChargeSchema.index({ school_id: 1, student_id: 1, created_at: -1 });
FlightChargeSchema.index({ school_id: 1, status: 1, created_at: -1 });
FlightChargeSchema.index({ flight_schedule_id: 1 });
FlightChargeSchema.index({ created_by: 1, created_at: -1 });

// Instance methods
FlightChargeSchema.methods.approve = function(approvedBy: mongoose.Types.ObjectId) {
  this.status = 'approved';
  this.approved_by = approvedBy;
  this.approved_at = new Date();
  this.reason_rejected = undefined;
  return this.save();
};

FlightChargeSchema.methods.reject = function(rejectedBy: mongoose.Types.ObjectId, reason: string) {
  this.status = 'rejected';
  this.approved_by = rejectedBy;
  this.approved_at = new Date();
  this.reason_rejected = reason;
  return this.save();
};

const FlightCharge = mongoose.models.FlightCharge || mongoose.model<IFlightCharge>('FlightCharge', FlightChargeSchema);

export default FlightCharge; 