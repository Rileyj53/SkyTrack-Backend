import mongoose, { Document, Schema } from 'mongoose';

// Define interfaces for nested objects
interface Attachment {
  _id?: mongoose.Types.ObjectId;
  name: string;
  url: string;
  type?: string;
}

interface StudentNote {
  _id?: mongoose.Types.ObjectId;
  student_id: mongoose.Types.ObjectId;
  author_id: mongoose.Types.ObjectId;
  author_name: string;
  type: string;
  title: string;
  content: string;
  created_at: Date;
  updated_at: Date;
  tags?: string[];
  is_private?: boolean;
  attachments?: Attachment[];
}

interface Requirement {
  name: string;
  total_hours: number;
  completed_hours: number;
  type: 'Standard' | 'Key' | 'Custom';
}

interface Milestone {
  name: string;
  description?: string;
  order: number;
  completed?: boolean;
  completedDate?: Date;
}

interface Stage {
  name: string;
  description?: string;
  order: number;
  completed?: boolean;
  completedDate?: Date;
}

// Define the Student document interface
export interface StudentDocument extends Document {
  school_id: mongoose.Types.ObjectId;
  user_id?: mongoose.Types.ObjectId;
  contact_email: string;
  phone?: string;
  certifications: string[];
  license_number?: string;
  emergency_contact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  enrollmentDate: Date;
  program: string;
  status: string;
  stage?: string;
  nextMilestone?: string;
  notes?: string;
  progress?: {
    requirements: Requirement[];
    milestones: Milestone[];
    stages: Stage[];
    lastUpdated: Date;
  };
  studentNotes?: StudentNote[];
  created_at: Date;
  updated_at: Date;
}

// Create the schema
const StudentSchema = new Schema<StudentDocument>(
  {
    school_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    contact_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: false,
      match: /^\d{3}-\d{3}-\d{4}$/ // Format: 555-555-1234
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
      required: false,
      sparse: true
    },
    emergency_contact: {
      name: String,
      relationship: String,
      phone: {
        type: String,
        match: /^\d{3}-\d{3}-\d{4}$/ // Format: 555-555-1234
      }
    },
    enrollmentDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    program: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: ['Active', 'Inactive', 'Graduated', 'On Hold', 'Discontinued'],
      default: 'Active'
    },
    stage: {
      type: String,
      trim: true
    },
    nextMilestone: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    progress: {
      requirements: [{
        name: {
          type: String,
          required: true
        },
        total_hours: {
          type: Number,
          required: true,
          min: 0
        },
        completed_hours: {
          type: Number,
          default: 0,
          min: 0
        },
        type: {
          type: String,
          enum: ['Standard', 'Key', 'Custom'],
          default: 'Standard'
        }
      }],
      milestones: [{
        name: {
          type: String,
          required: true
        },
        description: String,
        order: {
          type: Number,
          required: true,
          min: 0
        },
        completed: {
          type: Boolean,
          default: false
        },
        completedDate: Date
      }],
      stages: [{
        name: {
          type: String,
          required: true
        },
        description: String,
        order: {
          type: Number,
          required: true,
          min: 0
        },
        completed: {
          type: Boolean,
          default: false
        },
        completedDate: Date
      }],
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    },
    studentNotes: [{
      student_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
      },
      author_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      author_name: {
        type: String,
        required: true
      },
      type: {
        type: String,
        required: true,
        enum: ['flight', 'ground', 'medical', 'other']
      },
      title: {
        type: String,
        required: true
      },
      content: {
        type: String,
        required: true
      },
      tags: [{
        type: String
      }],
      is_private: {
        type: Boolean,
        default: false
      },
      attachments: [{
        name: {
          type: String,
          required: true
        },
        url: {
          type: String,
          required: true
        },
        type: {
          type: String
        }
      }]
    }]
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

// Create compound index for school_id and license_number to ensure uniqueness within a school
StudentSchema.index({ school_id: 1, license_number: 1 }, { unique: true, sparse: true });

// Create the model if it doesn't exist, otherwise use the existing one
const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

export default Student; 