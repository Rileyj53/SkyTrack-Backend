import mongoose, { Schema, Document } from 'mongoose';

export interface IAirworthinessDirective extends Document {
  aircraftId: mongoose.Types.ObjectId;
  adNumber: string;
  title: string;
  description: string;
  issuedDate: Date;
  effectiveDate: Date;
  complianceDate: Date;
  nextDueDate: Date;
  category: string;
  applicability: string;
  status: 'Compliant' | 'Pending' | 'Not Applicable';
  priority: string;
  estimatedLabor: number;
  estimatedParts: number;
  recurringInspection: boolean;
  recurringInterval: number;
  notes: string;
  attachments: Array<{
    name: string;
    url: string;
  }>;
  complianceMethod: string;
  references: string[];
  created_at: Date;
  updated_at: Date;
}

const AirworthinessDirectiveSchema = new Schema({
  aircraftId: {
    type: Schema.Types.ObjectId,
    ref: 'Plane',
    required: true
  },
  adNumber: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  issuedDate: {
    type: Date
  },
  effectiveDate: {
    type: Date
  },
  complianceDate: {
    type: Date
  },
  nextDueDate: {
    type: Date
  },
  category: {
    type: String
  },
  applicability: {
    type: String
  },
  status: {
    type: String,
    enum: ['Compliant', 'Pending', 'Not Applicable'],
    required: true
  },
  priority: {
    type: String
  },
  estimatedLabor: {
    type: Number
  },
  estimatedParts: {
    type: Number
  },
  recurringInspection: {
    type: Boolean,
    default: false
  },
  recurringInterval: {
    type: Number
  },
  notes: {
    type: String
  },
  attachments: [{
    name: {
      type: String
    },
    url: {
      type: String
    }
  }],
  complianceMethod: {
    type: String
  },
  references: [{
    type: String
  }]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes
AirworthinessDirectiveSchema.index({ aircraftId: 1, adNumber: 1 }, { unique: true });
AirworthinessDirectiveSchema.index({ status: 1 });
AirworthinessDirectiveSchema.index({ nextDueDate: 1 });

const AirworthinessDirective = mongoose.models.AirworthinessDirective || mongoose.model<IAirworthinessDirective>('AirworthinessDirective', AirworthinessDirectiveSchema);

export default AirworthinessDirective; 