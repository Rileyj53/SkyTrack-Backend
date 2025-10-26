import mongoose, { Schema, Document } from 'mongoose';

export interface IFlightScheduleRequest extends Document {
  organization_id: mongoose.Types.ObjectId;
  plane_id: mongoose.Types.ObjectId;
  instructor_id?: mongoose.Types.ObjectId;
  student_id: mongoose.Types.ObjectId;
  requested_by: mongoose.Types.ObjectId; // User ID of the requester
  scheduled_start_time: Date;
  scheduled_end_time: Date;
  scheduled_duration: number; // Calculated automatically from scheduled times (in hours)
  flight_type: string;
  status: 'pending' | 'approved' | 'rejected';
  request_notes?: string; // Student's notes/reason for the request
  admin_notes?: string; // Admin's notes when approving/rejecting
  approved_by?: mongoose.Types.ObjectId; // User ID of admin who approved/rejected
  approved_at?: Date; // When it was approved/rejected
  created_at: Date;
  updated_at: Date;
}

const FlightScheduleRequestSchema = new Schema<IFlightScheduleRequest>({
  organization_id: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'Organization ID is required'],
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
    required: false,
    index: true
  },
  student_id: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required'],
    index: true
  },
  requested_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requested by user ID is required'],
    index: true
  },
  scheduled_start_time: {
    type: Date,
    required: [true, 'Scheduled start time is required']
  },
  scheduled_end_time: {
    type: Date,
    required: [true, 'Scheduled end time is required']
  },
  scheduled_duration: {
    type: Number,
    required: false, // Will be calculated automatically
    min: [0, 'Scheduled duration cannot be negative'],
    default: 0
  },
  flight_type: {
    type: String,
    required: [true, 'Flight type is required'],
    trim: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  request_notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Request notes cannot exceed 1000 characters']
  },
  admin_notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Admin notes cannot exceed 1000 characters']
  },
  approved_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  approved_at: {
    type: Date,
    required: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Pre-save middleware to calculate scheduled duration automatically
FlightScheduleRequestSchema.pre('save', function(next) {
  // Calculate scheduled duration
  if (this.scheduled_start_time && this.scheduled_end_time) {
    const startTime = new Date(this.scheduled_start_time);
    const endTime = new Date(this.scheduled_end_time);
    
    if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
      const durationMs = endTime.getTime() - startTime.getTime();
      this.scheduled_duration = Math.max(0, durationMs / (1000 * 60 * 60)); // Convert to hours, ensure non-negative
    }
  }
  
  // Set approved_at timestamp when status changes to approved or rejected
  if (this.isModified('status') && this.status !== 'pending') {
    this.approved_at = new Date();
  }
  
  next();
});

// Pre-update middleware to calculate durations when updating
FlightScheduleRequestSchema.pre(['findOneAndUpdate', 'updateOne'], function(next) {
  const update = this.getUpdate() as any;
  if (update.$set) {
    // Calculate scheduled duration
    if (update.$set.scheduled_start_time && update.$set.scheduled_end_time) {
      const startTime = new Date(update.$set.scheduled_start_time);
      const endTime = new Date(update.$set.scheduled_end_time);
      
      if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
        const durationMs = endTime.getTime() - startTime.getTime();
        update.$set.scheduled_duration = Math.max(0, durationMs / (1000 * 60 * 60)); // Convert to hours, ensure non-negative
      }
    }
    
    // Set approved_at timestamp when status changes to approved or rejected
    if (update.$set.status && update.$set.status !== 'pending') {
      update.$set.approved_at = new Date();
    }
  }
  next();
});

// Create compound indexes for efficient querying
FlightScheduleRequestSchema.index({ organization_id: 1, status: 1 });
FlightScheduleRequestSchema.index({ organization_id: 1, scheduled_start_time: 1 });
FlightScheduleRequestSchema.index({ student_id: 1, status: 1 });
FlightScheduleRequestSchema.index({ requested_by: 1, status: 1 });
FlightScheduleRequestSchema.index({ status: 1, created_at: -1 });

const FlightScheduleRequest = mongoose.models.FlightScheduleRequest || mongoose.model<IFlightScheduleRequest>('FlightScheduleRequest', FlightScheduleRequestSchema);

export default FlightScheduleRequest;