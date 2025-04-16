import mongoose from 'mongoose';

// Define the schedule schema
const scheduleSchema = new mongoose.Schema({
  school_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required'],
    index: true
  },
  plane_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plane',
    required: false, // Optional as plane might be assigned later
    index: true
  },
  instructor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pilot',
    required: false, // Optional as instructor might be assigned later
    index: true
  },
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pilot',
    required: [true, 'Student ID is required'],
    index: true
  },
  start_time: {
    type: Date,
    required: [true, 'Start time is required']
  },
  end_time: {
    type: Date,
    required: [true, 'End time is required']
  },
  flight_type: {
    type: String,
    required: [true, 'Flight type is required']
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
  // Additional useful fields
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator ID is required'],
    index: true
  },
  last_updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  weather_conditions: {
    type: String,
    trim: true
  },
  flight_goals: {
    type: String,
    trim: true
  },
  cancellation_reason: {
    type: String,
    trim: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create compound index for school_id and start_time to optimize queries
scheduleSchema.index({ school_id: 1, start_time: 1 });

// Create compound index for student_id and start_time to optimize queries
scheduleSchema.index({ student_id: 1, start_time: 1 });

// Create compound index for instructor_id and start_time to optimize queries
scheduleSchema.index({ instructor_id: 1, start_time: 1 });

// Create compound index for plane_id and start_time to optimize queries
scheduleSchema.index({ plane_id: 1, start_time: 1 });

// Create the model
const Schedule = mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema);

export default Schedule; 