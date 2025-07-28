import mongoose, { Schema, Document } from 'mongoose';

export interface IFlightSchedule extends Document {
  organization_id: mongoose.Types.ObjectId;
  plane_id: mongoose.Types.ObjectId;
  instructor_id?: mongoose.Types.ObjectId;
  student_id: mongoose.Types.ObjectId;
  scheduled_start_time: Date;
  scheduled_end_time: Date;
  scheduled_duration: number; // Calculated automatically from scheduled times (in hours)
  actual_start_time?: Date; // Optional, null by default
  actual_end_time?: Date; // Optional, null by default
  actual_duration?: number; // Optional, null by default, calculated from actual times (in hours)
  flight_type?: string;
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'canceled' | 'no-show';
  notes?: string;
  // Optional approval tracking fields (for schedules created from requests)
  request_id?: mongoose.Types.ObjectId; // Reference to the original FlightScheduleRequest
  approved_by?: mongoose.Types.ObjectId; // User ID of admin who approved the request
  approved_at?: Date; // When the request was approved
  request_notes?: string; // Original request notes from student
  created_at: Date;
  updated_at: Date;
}

const FlightScheduleSchema = new Schema<IFlightSchedule>({
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
  actual_start_time: {
    type: Date,
    required: false,
    default: null
  },
  actual_end_time: {
    type: Date,
    required: false,
    default: null
  },
  actual_duration: {
    type: Number,
    required: false,
    min: [0, 'Actual duration cannot be negative'],
    default: null
  },
  flight_type: {
    type: String,
    required: false, // Made optional
    trim: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['scheduled', 'confirmed', 'in-progress', 'completed', 'canceled', 'no-show'],
    default: 'scheduled'
  },
  notes: {
    type: String,
    trim: true
  },
  // Optional approval tracking fields (for schedules created from requests)
  request_id: {
    type: Schema.Types.ObjectId,
    ref: 'FlightScheduleRequest',
    required: false,
    index: true
  },
  approved_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  approved_at: {
    type: Date,
    required: false
  },
  request_notes: {
    type: String,
    trim: true,
    maxLength: [1000, 'Request notes cannot exceed 1000 characters']
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Pre-save middleware to calculate scheduled duration automatically
FlightScheduleSchema.pre('save', function(next) {
  // Calculate scheduled duration
  if (this.scheduled_start_time && this.scheduled_end_time) {
    const startTime = new Date(this.scheduled_start_time);
    const endTime = new Date(this.scheduled_end_time);
    
    if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
      const durationMs = endTime.getTime() - startTime.getTime();
      this.scheduled_duration = Math.max(0, durationMs / (1000 * 60 * 60)); // Convert to hours, ensure non-negative
    }
  }
  
  // Calculate actual duration if both actual times are provided
  if (this.actual_start_time && this.actual_end_time) {
    const actualStartTime = new Date(this.actual_start_time);
    const actualEndTime = new Date(this.actual_end_time);
    
    if (!isNaN(actualStartTime.getTime()) && !isNaN(actualEndTime.getTime())) {
      const actualDurationMs = actualEndTime.getTime() - actualStartTime.getTime();
      this.actual_duration = Math.max(0, actualDurationMs / (1000 * 60 * 60)); // Convert to hours, ensure non-negative
    }
  }
  
  next();
});

// Pre-update middleware to calculate durations when updating
FlightScheduleSchema.pre(['findOneAndUpdate', 'updateOne'], function(next) {
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
    
    // Calculate actual duration
    if (update.$set.actual_start_time && update.$set.actual_end_time) {
      const actualStartTime = new Date(update.$set.actual_start_time);
      const actualEndTime = new Date(update.$set.actual_end_time);
      
      if (!isNaN(actualStartTime.getTime()) && !isNaN(actualEndTime.getTime())) {
        const actualDurationMs = actualEndTime.getTime() - actualStartTime.getTime();
        update.$set.actual_duration = Math.max(0, actualDurationMs / (1000 * 60 * 60)); // Convert to hours, ensure non-negative
      }
    }
  }
  next();
});

// Create compound indexes for efficient querying
FlightScheduleSchema.index({ organization_id: 1, scheduled_start_time: 1 });
FlightScheduleSchema.index({ plane_id: 1, scheduled_start_time: 1 });
FlightScheduleSchema.index({ instructor_id: 1, scheduled_start_time: 1 });
FlightScheduleSchema.index({ student_id: 1, scheduled_start_time: 1 });
FlightScheduleSchema.index({ request_id: 1 }); // For finding schedules created from requests

const FlightSchedule = mongoose.models.FlightSchedule || mongoose.model<IFlightSchedule>('FlightSchedule', FlightScheduleSchema);

export default FlightSchedule; 