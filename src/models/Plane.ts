import mongoose from 'mongoose';

// Define the plane schema
const planeSchema = new mongoose.Schema({
  tail_number: {
    type: String,
    required: [true, 'Tail number is required'],
    trim: true,
    uppercase: true
  },
  model: {
    type: String,
    required: [true, 'Aircraft model is required'],
    trim: true
  },
  status: {
    type: String,
    required: [true, 'Aircraft status is required'],
    enum: ['active', 'maintenance', 'inactive', 'retired'],
    default: 'active'
  },
  capacity: {
    type: Number,
    required: [true, 'Aircraft capacity is required'],
    min: [1, 'Capacity must be at least 1']
  },
  location: {
    type: String,
    required: [true, 'Aircraft location is required'],
    trim: true
  },
  school_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  // Additional useful fields
  year_manufactured: {
    type: Number,
    required: [true, 'Year manufactured is required']
  },
  last_maintenance_date: {
    type: Date
  },
  next_maintenance_date: {
    type: Date
  },
  total_flight_hours: {
    type: Number,
    default: 0
  },
  notes: {
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

// Create a compound index for tail_number and school_id to ensure uniqueness within a school
planeSchema.index({ tail_number: 1, school_id: 1 }, { unique: true });

// Create the model if it doesn't exist, otherwise use the existing one
const Plane = mongoose.models.Plane || mongoose.model('Plane', planeSchema);

export default Plane; 