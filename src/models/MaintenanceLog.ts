import mongoose, { Schema, Document } from 'mongoose';

export interface IPartReplaced {
  partNumber: string;
  description: string;
  quantity: number;
  cost: number;
}

export interface ITechnician {
  name: string;
  certificate: string;
  signature: string;
}

export interface IAircraftHours {
  total: number;
  sinceLastOverhaul: number;
}

export interface INextDue {
  hours: number;
  date: Date;
}

export interface IMaintenanceLog extends Document {
  aircraftId: mongoose.Types.ObjectId;
  date: Date;
  type: 'Annual' | '100-Hour' | 'Repair' | 'Modification' | 'Service' | 'AD Compliance';
  description: string;
  workPerformed: string;
  partsReplaced: IPartReplaced[];
  technician: ITechnician;
  aircraftHours: IAircraftHours;
  nextDue: INextDue;
  status: 'Completed' | 'Scheduled' | 'In Progress' | 'Deferred';
  referenceDocuments: string[];
  notes: string;
  created_at: Date;
  updated_at: Date;
}

const MaintenanceLogSchema = new Schema({
  aircraftId: {
    type: Schema.Types.ObjectId,
    ref: 'Plane',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ['Annual', '100-Hour', 'Repair', 'Modification', 'Service', 'AD Compliance'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  workPerformed: {
    type: String,
    required: true
  },
  partsReplaced: [{
    partNumber: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    cost: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  technician: {
    name: {
      type: String,
      required: true
    },
    certificate: {
      type: String,
      required: true
    },
    signature: {
      type: String,
      required: true
    }
  },
  aircraftHours: {
    total: {
      type: Number,
      required: true,
      min: 0
    },
    sinceLastOverhaul: {
      type: Number,
      required: true,
      min: 0
    }
  },
  nextDue: {
    hours: {
      type: Number,
      required: true,
      min: 0
    },
    date: {
      type: Date,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['Completed', 'Scheduled', 'In Progress', 'Deferred'],
    required: true
  },
  referenceDocuments: [{
    type: String
  }],
  notes: {
    type: String
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes
MaintenanceLogSchema.index({ aircraftId: 1, date: -1 });
MaintenanceLogSchema.index({ aircraftId: 1, type: 1 });
MaintenanceLogSchema.index({ status: 1 });

const MaintenanceLog = mongoose.models.MaintenanceLog || mongoose.model<IMaintenanceLog>('MaintenanceLog', MaintenanceLogSchema);

export default MaintenanceLog; 