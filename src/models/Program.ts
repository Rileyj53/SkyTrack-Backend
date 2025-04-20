import mongoose, { Schema, Document } from 'mongoose';

// Define interfaces for nested objects
interface IRequirement {
  name: string;
  hours: number;
  type: 'Standard' | 'Key' | 'Custom';
}

interface IMilestone {
  name: string;
  description?: string;
  order: number;
}

interface IStage {
  name: string;
  description?: string;
  order: number;
}

// Define the Program document interface
export interface IProgram extends Document {
  school_id: mongoose.Types.ObjectId;
  program_name: string;
  requirements: IRequirement[];
  milestones: IMilestone[];
  stages: IStage[];
  description?: string;
  duration?: string;
  cost?: number;
  created_at: Date;
  updated_at: Date;
}

const ProgramSchema = new Schema({
  school_id: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  program_name: {
    type: String,
    required: [true, 'Program name is required'],
    trim: true
  },
  requirements: [{
    name: {
      type: String,
      required: [true, 'Requirement name is required']
    },
    hours: {
      type: Number,
      required: [true, 'Requirement hours is required'],
      min: [0, 'Hours cannot be negative']
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
      required: [true, 'Milestone name is required']
    },
    description: {
      type: String
    },
    order: {
      type: Number,
      required: [true, 'Milestone order is required'],
      min: [0, 'Order cannot be negative']
    }
  }],
  stages: [{
    name: {
      type: String,
      required: [true, 'Stage name is required']
    },
    description: {
      type: String
    },
    order: {
      type: Number,
      required: [true, 'Stage order is required'],
      min: [0, 'Order cannot be negative']
    }
  }],
  description: {
    type: String,
    trim: true
  },
  duration: {
    type: String,
    trim: true
  },
  cost: {
    type: Number,
    min: [0, 'Cost cannot be negative']
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes
ProgramSchema.index({ school_id: 1, program_name: 1 }, { unique: true });

// Create the model if it doesn't exist, otherwise use the existing one
const Program = mongoose.models.Program || mongoose.model<IProgram>('Program', ProgramSchema);

export default Program; 