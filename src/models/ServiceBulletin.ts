import mongoose, { Schema, Document } from 'mongoose';

export interface IServiceBulletin extends Document {
  aircraftId: mongoose.Types.ObjectId;
  sbNumber: string;
  title: string;
  description: string;
  status: 'Completed' | 'Pending' | 'Not Applicable';
  completionDate: Date;
  notes: string;
  created_at: Date;
  updated_at: Date;
}

const ServiceBulletinSchema = new Schema({
  aircraftId: {
    type: Schema.Types.ObjectId,
    ref: 'Plane',
    required: true
  },
  sbNumber: {
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
  status: {
    type: String,
    enum: ['Completed', 'Pending', 'Not Applicable'],
    required: true
  },
  completionDate: {
    type: Date
  },
  notes: {
    type: String
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes
ServiceBulletinSchema.index({ aircraftId: 1, sbNumber: 1 }, { unique: true });
ServiceBulletinSchema.index({ status: 1 });

const ServiceBulletin = mongoose.models.ServiceBulletin || mongoose.model<IServiceBulletin>('ServiceBulletin', ServiceBulletinSchema);

export default ServiceBulletin; 