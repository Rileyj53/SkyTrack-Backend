import mongoose, { Schema, Document } from 'mongoose';

export interface IFlightLog extends Document {
  date: Date;
  start_time: string;
  plane_reg: string;
  plane_id: mongoose.Types.ObjectId;
  student_name: string;
  student_id: mongoose.Types.ObjectId;
  instructor: string;
  instructor_id: mongoose.Types.ObjectId;
  duration: number;
  type: string;
  status: 'Completed' | 'Scheduled' | 'In-Flight' | 'Canceled';
  school_id: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const FlightLogSchema: Schema = new Schema({
  date: {
    type: Date,
    required: [true, 'Flight date is required'],
  },
  start_time: {
    type: String,
    required: [true, 'Start time is required'],
  },
  plane_reg: {
    type: String,
    required: [true, 'Plane registration number is required'],
    uppercase: true,
  },
  plane_id: {
    type: Schema.Types.ObjectId,
    ref: 'Plane',
    required: [true, 'Plane ID is required'],
  },
  student_name: {
    type: String,
    required: [true, 'Student name is required'],
  },
  student_id: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required'],
  },
  instructor: {
    type: String,
    required: [true, 'Instructor name is required'],
  },
  instructor_id: {
    type: Schema.Types.ObjectId,
    ref: 'Instructor',
    required: [true, 'Instructor ID is required'],
  },
  duration: {
    type: Number,
    required: [true, 'Flight duration is required'],
    min: [0, 'Duration cannot be negative'],
  },
  type: {
    type: String,
    required: [true, 'Flight type is required']
  },
  status: {
    type: String,
    required: [true, 'Flight status is required'],
    default: 'Scheduled',
  },
  school_id: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required'],
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

// Create index for faster queries
FlightLogSchema.index({ school_id: 1, date: -1 });
FlightLogSchema.index({ student_id: 1, date: -1 });
FlightLogSchema.index({ instructor_id: 1, date: -1 });
FlightLogSchema.index({ plane_id: 1, date: -1 });

// Pre-save middleware to ensure plane_reg is uppercase
FlightLogSchema.pre('save', function(next) {
  if (this.plane_reg && typeof this.plane_reg === 'string') {
    this.plane_reg = this.plane_reg.toUpperCase();
  }
  next();
});

const FlightLog = mongoose.models.FlightLog || mongoose.model<IFlightLog>('FlightLog', FlightLogSchema);

export default FlightLog; 