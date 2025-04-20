import mongoose, { Document, Schema } from 'mongoose';

// Interface for emergency contact
interface IEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

// Interface for availability time slots
interface IAvailabilityTime {
  [key: string]: string[]; // e.g., "monday": ["09:00-17:00"]
}

// Interface for documents
interface IDocument {
  type: string;
  name: string;
  number: string;
  issue_date: Date;
  expiry_date: Date;
  url: string;
}

// Interface for hourly rates
interface IHourlyRates {
  primary: number;
  instrument: number;
  advanced: number;
  multiEngine: number;
}

// Main instructor interface
export interface IInstructor extends Document {
  school_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  contact_email: string;
  phone: string;
  certifications: string[];
  license_number: string;
  emergency_contact: IEmergencyContact;
  specialties: string[];
  status: string;
  hourlyRates: IHourlyRates;
  flightHours: number;
  teachingHours: number;
  availability: string;
  students: number;
  utilization: number;
  ratings: string[];
  availability_time: IAvailabilityTime;
  notes: string;
  documents: IDocument[];
  created_at: Date;
  updated_at: Date;
}

// Schema definition
const InstructorSchema = new Schema<IInstructor>(
  {
    school_id: {
      type: Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    contact_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    certifications: [{
      type: String,
      trim: true,
    }],
    license_number: {
      type: String,
      required: true,
      trim: true,
    },
    emergency_contact: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      relationship: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
    },
    specialties: [{
      type: String,
      trim: true,
    }],
    status: {
      type: String,
      required: true,
      enum: ['Active', 'Inactive', 'On Leave', 'Terminated'],
      default: 'Active',
    },
    hourlyRates: {
      primary: {
        type: Number,
        required: true,
        min: 0,
      },
      instrument: {
        type: Number,
        required: true,
        min: 0,
      },
      advanced: {
        type: Number,
        required: true,
        min: 0,
      },
      multiEngine: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    flightHours: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    teachingHours: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    availability: {
      type: String,
      required: true,
      enum: ['Full-time', 'Part-time', 'Weekends Only', 'On Call'],
      default: 'Full-time',
    },
    students: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    utilization: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    ratings: [{
      type: String,
      trim: true,
    }],
    availability_time: {
      monday: [String],
      tuesday: [String],
      wednesday: [String],
      thursday: [String],
      friday: [String],
      saturday: [String],
      sunday: [String],
    },
    notes: {
      type: String,
      trim: true,
    },
    documents: [{
      type: {
        type: String,
        required: true,
        trim: true,
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      number: {
        type: String,
        required: true,
        trim: true,
      },
      issue_date: {
        type: Date,
        required: true,
      },
      expiry_date: {
        type: Date,
        required: true,
      },
      url: {
        type: String,
        required: true,
        trim: true,
      },
    }],
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Create indexes
InstructorSchema.index({ school_id: 1 });
InstructorSchema.index({ user_id: 1 }, { unique: true });
InstructorSchema.index({ license_number: 1 }, { unique: true });
InstructorSchema.index({ status: 1 });

// Create and export the model
const Instructor = mongoose.models.Instructor || mongoose.model<IInstructor>('Instructor', InstructorSchema);

export default Instructor; 