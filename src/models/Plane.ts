import mongoose, { Schema, Document } from 'mongoose';

export interface IPlane extends Document {
  registration: string;
  type: string;
  aircraftModel: string;
  school_id: mongoose.Types.ObjectId;
  status: string;
  last_maintenance: Date;
  next_maintenance: Date;
  total_hours: number;
  created_at: Date;
  updated_at: Date;
}

const planeSchema = new Schema<IPlane>({
  registration: { type: String, required: true },
  type: { type: String, required: true },
  aircraftModel: { type: String, required: true },
  school_id: { type: Schema.Types.ObjectId, ref: 'School', required: true },
  status: { type: String, required: true, default: 'active' },
  last_maintenance: { type: Date, required: true },
  next_maintenance: { type: Date, required: true },
  total_hours: { type: Number, required: true, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const Plane = mongoose.models.Plane || mongoose.model<IPlane>('Plane', planeSchema);

export default Plane; 