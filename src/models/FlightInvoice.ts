import mongoose, { Schema, Document } from 'mongoose';

export interface ILineItem {
  name: string; // Flexible name for the line item (e.g., "Aircraft Rental", "Instruction", "Platform Fee")
  description: string; // Detailed description
  quantity: number; // Usually flight duration for aircraft/instruction
  unit_rate: number;
  total_amount: number;
  notes?: string;
}

export interface IFlightInvoice extends Document {
  flight_schedule_id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  student_id: mongoose.Types.ObjectId;
  plane_id: mongoose.Types.ObjectId;
  instructor_id?: mongoose.Types.ObjectId;
  
  // Invoice details
  invoice_number: string; // Auto-generated unique invoice number
  invoice_date: Date;
  due_date?: Date;
  
  // Line items
  line_items: ILineItem[];
  
  // Totals
  subtotal: number; // Sum of all line items
  tax_rate?: number; // Tax percentage (if applicable)
  tax_amount?: number; // Calculated tax amount
  total_amount: number; // Final total including tax
  currency: string;
  
  // Status and workflow
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  reason_rejected?: string; // Reason for rejection (if status is 'rejected')
  
  // Approval tracking
  approved_by?: mongoose.Types.ObjectId; // User who approved/rejected the invoice
  approved_at?: Date; // When the invoice was approved/rejected
  
  // Metadata
  created_by: mongoose.Types.ObjectId;
  notes?: string;
  
  created_at: Date;
  updated_at: Date;
}

const LineItemSchema = new Schema<ILineItem>({
  name: { 
    type: String, 
    required: [true, 'Line item name is required'],
    trim: true,
    maxlength: [100, 'Line item name cannot exceed 100 characters']
  },
  description: { 
    type: String, 
    required: [true, 'Line item description is required'],
    trim: true,
    maxlength: [500, 'Line item description cannot exceed 500 characters']
  },
  quantity: { 
    type: Number, 
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative']
  },
  unit_rate: { 
    type: Number, 
    required: [true, 'Unit rate is required'],
    min: [0, 'Unit rate cannot be negative']
  },
  total_amount: { 
    type: Number, 
    required: [true, 'Total amount is required']
  },
  notes: { 
    type: String,
    trim: true,
    maxlength: [250, 'Line item notes cannot exceed 250 characters']
  }
}, { _id: false });

const FlightInvoiceSchema = new Schema<IFlightInvoice>({
  flight_schedule_id: {
    type: Schema.Types.ObjectId,
    ref: 'FlightSchedule',
    required: [true, 'Flight schedule ID is required'],
    index: true
  },
  organization_id: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'Organization ID is required'],
    index: true
  },
  student_id: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required'],
    index: true
  },
  plane_id: {
    type: Schema.Types.ObjectId,
    ref: 'Plane',
    required: [true, 'Plane ID is required']
  },
  instructor_id: {
    type: Schema.Types.ObjectId,
    ref: 'Instructor',
    required: false
  },
  
  // Invoice details
  invoice_number: {
    type: String,
    required: false, // Auto-generated in pre-save hook
    unique: true,
    index: true,
    trim: true
  },
  invoice_date: {
    type: Date,
    required: [true, 'Invoice date is required'],
    default: Date.now
  },
  due_date: {
    type: Date,
    required: false
  },
  
  // Line items
  line_items: {
    type: [LineItemSchema],
    required: [true, 'At least one line item is required'],
    validate: {
      validator: function(items: ILineItem[]) {
        return items && items.length > 0;
      },
      message: 'Invoice must have at least one line item'
    }
  },
  
  // Totals
  subtotal: { 
    type: Number, 
    required: [true, 'Subtotal is required'],
    default: 0,
    min: [0, 'Subtotal cannot be negative']
  },
  tax_rate: { 
    type: Number, 
    min: [0, 'Tax rate cannot be negative'],
    max: [100, 'Tax rate cannot exceed 100%']
  },
  tax_amount: { 
    type: Number, 
    default: 0,
    min: [0, 'Tax amount cannot be negative']
  },
  total_amount: { 
    type: Number, 
    required: [true, 'Total amount is required'],
    default: 0,
    min: [0, 'Total amount cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
    default: 'USD',
    uppercase: true,
    trim: true
  },
  
  // Status
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'draft'
  },
  reason_rejected: {
    type: String,
    trim: true,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  
  // Approval tracking
  approved_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  approved_at: { type: Date },
  
  // Metadata
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required'],
    index: true
  },
  notes: { 
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  }
  
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Auto-generate invoice number before validation
FlightInvoiceSchema.pre('validate', async function(next) {
  try {
    // Auto-generate invoice number for new invoices
    if (this.isNew && !this.invoice_number) {
      const year = new Date().getFullYear();
      const count = await mongoose.model('FlightInvoice').countDocuments({
        created_at: {
          $gte: new Date(year, 0, 1),
          $lt: new Date(year + 1, 0, 1)
        }
      });
      this.invoice_number = `INV-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Calculate totals before saving
FlightInvoiceSchema.pre('save', function(next) {
  try {
    // Recalculate line item totals
    this.line_items.forEach(item => {
      item.total_amount = Math.round(item.quantity * item.unit_rate * 100) / 100;
    });
    
    // Recalculate invoice totals
    this.subtotal = Math.round(this.line_items.reduce((sum, item) => sum + item.total_amount, 0) * 100) / 100;
    this.tax_amount = this.tax_rate ? Math.round(this.subtotal * this.tax_rate / 100 * 100) / 100 : 0;
    this.total_amount = Math.round((this.subtotal + this.tax_amount) * 100) / 100;
    
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Pre-update middleware for findOneAndUpdate operations
FlightInvoiceSchema.pre(['findOneAndUpdate', 'updateOne'], function(next) {
  const update = this.getUpdate() as any;
  if (update.$set?.line_items) {
    // Recalculate totals for updates
    const lineItems = update.$set.line_items;
    lineItems.forEach((item: ILineItem) => {
      item.total_amount = Math.round(item.quantity * item.unit_rate * 100) / 100;
    });
    
    const subtotal = Math.round(lineItems.reduce((sum: number, item: ILineItem) => sum + item.total_amount, 0) * 100) / 100;
    const taxRate = update.$set.tax_rate || 0;
    const taxAmount = Math.round(subtotal * taxRate / 100 * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
    
    update.$set.subtotal = subtotal;
    update.$set.tax_amount = taxAmount;
    update.$set.total_amount = totalAmount;
  }
  next();
});

// Indexes for efficient querying
FlightInvoiceSchema.index({ organization_id: 1, status: 1, created_at: -1 });
FlightInvoiceSchema.index({ student_id: 1, created_at: -1 });
FlightInvoiceSchema.index({ flight_schedule_id: 1 });
FlightInvoiceSchema.index({ invoice_number: 1 }, { unique: true });
FlightInvoiceSchema.index({ invoice_date: -1 });

const FlightInvoice = mongoose.models.FlightInvoice || mongoose.model<IFlightInvoice>('FlightInvoice', FlightInvoiceSchema);

export default FlightInvoice; 