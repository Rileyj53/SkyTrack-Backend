import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { SchoolBillingUsage } from '../../../../../models/SchoolBillingUsage';
import { connectDB } from '../../../../../lib/db';
import { authenticateRequest } from '../../../../../lib/auth';

// PATCH /api/school-billing-usage/[id]/mark-billed - Mark record as billed
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate request
    const authResult = authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message || 'Authentication required' },
        { status: 401 }
      );
    }

    await connectDB();
    
    const { id } = params;
    const body = await request.json();
    const { stripe_invoice_id } = body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid billing usage ID' },
        { status: 400 }
      );
    }

    const record = await SchoolBillingUsage.findByIdAndUpdate(
      id,
      { 
        billed: true,
        stripe_invoice_id: stripe_invoice_id || null,
        last_updated: new Date()
      },
      { new: true, runValidators: true }
    ).populate('school_id', 'name');

    if (!record) {
      return NextResponse.json(
        { error: 'Billing usage record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('Error marking billing usage as billed:', error);
    return NextResponse.json(
      { error: 'Failed to mark billing usage as billed' },
      { status: 500 }
    );
  }
} 