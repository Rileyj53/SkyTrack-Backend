import mongoose, { Schema, Document } from 'mongoose';

export interface IComponentHours {
  total: number;
  sinceOverhaul: number;
  nextOverhaul: number;
}

export interface IMaintenanceSchedule extends Document {
  aircraftId: mongoose.Types.ObjectId;
  nextAnnual: Date;
  next100Hour: Date;
  nextOilChange: Date;
  nextInspection: Date;
  lastAnnual: Date;
  last100Hour: Date;
  lastOilChange: Date;
  lastInspection: Date;
  componentHours: {
    engine: IComponentHours;
    propeller: IComponentHours;
    landingGear: IComponentHours;
  };
  created_at: Date;
  updated_at: Date;
}

const MaintenanceScheduleSchema = new Schema({
  aircraftId: {
    type: Schema.Types.ObjectId,
    ref: 'Plane',
    required: true,
    unique: true
  },
  nextAnnual: {
    type: Date
  },
  next100Hour: {
    type: Date
  },
  nextOilChange: {
    type: Date
  },
  nextInspection: {
    type: Date
  },
  lastAnnual: {
    type: Date
  },
  last100Hour: {
    type: Date
  },
  lastOilChange: {
    type: Date
  },
  lastInspection: {
    type: Date
  },
  componentHours: {
    engine: {
      total: {
        type: Number,
        required: true,
        min: 0
      },
      sinceOverhaul: {
        type: Number,
        required: true,
        min: 0
      },
      nextOverhaul: {
        type: Number,
        required: true,
        min: 0
      }
    },
    propeller: {
      total: {
        type: Number,
        required: true,
        min: 0
      },
      sinceOverhaul: {
        type: Number,
        required: true,
        min: 0
      },
      nextOverhaul: {
        type: Number,
        required: true,
        min: 0
      }
    },
    landingGear: {
      total: {
        type: Number,
        required: true,
        min: 0
      },
      sinceOverhaul: {
        type: Number,
        required: true,
        min: 0
      },
      nextOverhaul: {
        type: Number,
        required: true,
        min: 0
      }
    }
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const MaintenanceSchedule = mongoose.models.MaintenanceSchedule || mongoose.model<IMaintenanceSchedule>('MaintenanceSchedule', MaintenanceScheduleSchema);

export default MaintenanceSchedule; 