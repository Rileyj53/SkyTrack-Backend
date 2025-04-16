import mongoose from 'mongoose';

// Define the pilot schema
const pilotSchema = new mongoose.Schema({
  school_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  first_name: {
    type: String,
    required: true
  },
  last_name: {
    type: String,
    required: true
  },
  contact_email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true,
    match: /^\d{3}-\d{3}-\d{4}$/ // Format: 555-555-1234
  },
  pilot_type: {
    type: String,
    enum: ['instructor', 'student'],
    required: true
  },
  certifications: [{
    type: String,
    enum: [
      'private',
      'instrument',
      'commercial',
      'multi-engine',
      'cfi',
      'cfii',
      'mei',
      'atp'
    ]
  }],
  license_number: {
    type: String,
    required: true,
    unique: true
  },
  emergency_contact: {
    name: String,
    relationship: String,
    phone: {
      type: String,
      match: /^\d{3}-\d{3}-\d{4}$/ // Format: 555-555-1234
    }
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

// Create compound index for school_id and license_number to ensure uniqueness within a school
pilotSchema.index({ school_id: 1, license_number: 1 }, { unique: true });

// Create the model if it doesn't exist, otherwise use the existing one
const Pilot = mongoose.models.Pilot || mongoose.model('Pilot', pilotSchema);

// Ensure the model is registered
if (!mongoose.models.Pilot) {
  mongoose.model('Pilot', pilotSchema);
}

export default Pilot; 