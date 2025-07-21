import mongoose, { Schema, Document } from 'mongoose';

export interface IPlane extends Document {
  registration: string;
  type: string;
  aircraftModel: string;
  year?: number;
  organization_id: mongoose.Types.ObjectId;
  status: string;
  engineHours?: number;
  tach_time?: number;
  hopps_time?: number;
  last_maintenance: Date;
  next_maintenance: Date;
  total_hours: number;
  location?: string;
  hourlyRates?: {
    wet?: number;
    dry?: number;
    block?: number;
    instruction?: number;
    weekend?: number;
    solo?: number;
    checkride?: number;
  };
  specialRates?: any[];
  utilization?: {
    hoursPerMonth?: number;
    utilizationRate?: number;
  };
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

const planeSchema = new Schema<IPlane>({
  registration: { type: String, required: true },
  type: { type: String, required: true },
  aircraftModel: { type: String, required: true },
  year: { type: Number },
  organization_id: { type: Schema.Types.ObjectId, ref: 'School', required: true },
  status: { type: String, required: true, default: 'active' },
  engineHours: { type: Number },
  tach_time: { type: Number },
  hopps_time: { type: Number },
  last_maintenance: { type: Date, required: true },
  next_maintenance: { type: Date, required: true },
  total_hours: { type: Number, required: true, default: 0 },
  location: { type: String },
  hourlyRates: {
    wet: { type: Number },
    dry: { type: Number },
    block: { type: Number },
    instruction: { type: Number },
    weekend: { type: Number },
    solo: { type: Number },
    checkride: { type: Number }
  },
  specialRates: [{ type: Schema.Types.Mixed }],
  utilization: {
    hoursPerMonth: { type: Number },
    utilizationRate: { type: Number }
  },
  notes: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const Plane = mongoose.models.Plane || mongoose.model<IPlane>('Plane', planeSchema);

export default Plane; 