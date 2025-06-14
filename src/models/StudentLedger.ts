import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment {
  payment_id: string; // Can be stripe_payment_id or manual entry id
  amount: number;
  timestamp: Date;
  payment_method?: string; // Optional: 'stripe', 'cash', 'check', etc.
  notes?: string;
}

export interface IStudentLedger extends Document {
  school_id: mongoose.Types.ObjectId;
  student_id: mongoose.Types.ObjectId;
  balance: number; // Can be negative
  charges: mongoose.Types.ObjectId[]; // References to approved flight invoices
  payments: IPayment[];
  last_updated: Date;
  created_at: Date;
  updated_at: Date;
}

const PaymentSchema = new Schema<IPayment>({
  payment_id: {
    type: String,
    required: [true, 'Payment ID is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Payment amount cannot be negative']
  },
  timestamp: {
    type: Date,
    required: [true, 'Payment timestamp is required'],
    default: Date.now
  },
  payment_method: {
    type: String,
    trim: true,
    enum: ['stripe', 'cash', 'check', 'bank_transfer', 'credit_card', 'other']
  },
  notes: {
    type: String,
    trim: true
  }
}, { _id: false });

const StudentLedgerSchema = new Schema<IStudentLedger>({
  school_id: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required'],
    index: true
  },
  student_id: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required'],
    index: true,
    unique: true // Each student should have only one ledger
  },
  balance: {
    type: Number,
    required: [true, 'Balance is required'],
    default: 0.00
  },
  charges: [{
    type: Schema.Types.ObjectId,
    ref: 'FlightInvoice' // References to approved flight invoices
  }],
  payments: [PaymentSchema],
  last_updated: {
    type: Date,
    required: [true, 'Last updated timestamp is required'],
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Pre-save middleware to update last_updated timestamp
StudentLedgerSchema.pre('save', function(next) {
  this.last_updated = new Date();
  next();
});

// Pre-update middleware to update last_updated timestamp
StudentLedgerSchema.pre(['findOneAndUpdate', 'updateOne'], function(next) {
  const update = this.getUpdate() as any;
  if (update.$set) {
    update.$set.last_updated = new Date();
  } else {
    this.set({ last_updated: new Date() });
  }
  next();
});

// Create compound index for efficient querying
StudentLedgerSchema.index({ school_id: 1, student_id: 1 }, { unique: true });

// Instance method to calculate balance from charges and payments
StudentLedgerSchema.methods.calculateBalance = function() {
  const totalPayments = this.payments.reduce((sum: number, payment: IPayment) => sum + payment.amount, 0);
  // Note: To properly calculate balance, you'd need to populate charges and sum their amounts
  // For now, this method exists as a placeholder for future implementation
  return totalPayments;
};

// Instance method to add payment
StudentLedgerSchema.methods.addPayment = function(paymentData: Partial<IPayment>) {
  this.payments.push({
    payment_id: paymentData.payment_id,
    amount: paymentData.amount,
    timestamp: paymentData.timestamp || new Date(),
    payment_method: paymentData.payment_method,
    notes: paymentData.notes
  });
  this.last_updated = new Date();
  return this.save();
};

const StudentLedger = mongoose.models.StudentLedger || mongoose.model<IStudentLedger>('StudentLedger', StudentLedgerSchema);

export default StudentLedger; 