import mongoose, { Schema, Document } from 'mongoose';

export interface IAttachment {
  url: string;
  name: string;
  uploaded_at: Date;
}

export interface IPlaneRecord extends Document {
  plane_id: mongoose.Types.ObjectId;
  record_type?: 'maintenance' | 'airworthiness' | 'service_bulletin';
  title?: string;
  description: string;
  status?: string;
  date?: Date;
  nextDue?: Date;
  aircraftHours?: number;
  partsReplaced?: string[];
  notes?: string;
  attachments?: IAttachment[];
  created_at: Date;
  updated_at: Date;
}

const attachmentSchema = new Schema<IAttachment>({
  url: { type: String, required: true },
  name: { type: String, required: true },
  uploaded_at: { type: Date, default: Date.now }
});

const planeRecordSchema = new Schema<IPlaneRecord>({
  plane_id: { type: Schema.Types.ObjectId, ref: 'Plane', required: true },
  record_type: { 
    type: String, 
    enum: ['maintenance', 'airworthiness', 'service_bulletin'],
    required: false 
  },
  title: { type: String, required: false },
  description: { type: String, required: true },
  status: { type: String, required: false },
  date: { type: Date, required: false },
  nextDue: { type: Date, required: false },
  aircraftHours: { type: Number, required: false },
  partsReplaced: [{ type: String }],
  notes: { type: String, required: false },
  attachments: [attachmentSchema],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Update the updated_at field on save
planeRecordSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

const PlaneRecord = mongoose.models.PlaneRecord || mongoose.model<IPlaneRecord>('PlaneRecord', planeRecordSchema);

export default PlaneRecord; 