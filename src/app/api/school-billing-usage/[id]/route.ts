import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { SchoolBillingUsage } from '../../../../models/SchoolBillingUsage';
import { connectDB } from '../../../../lib/db';
import { authenticateRequest } from '../../../../lib/auth';

// GET /api/school-billing-usage/[id] - Get specific billing usage record
export async function GET(
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
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid billing usage ID' },
        { status: 400 }
      );
    }

    const record = await SchoolBillingUsage
      .findById(id)
      .populate('school_id', 'name');

    if (!record) {
      return NextResponse.json(
        { error: 'Billing usage record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('Error fetching billing usage record:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing usage record' },
      { status: 500 }
    );
  }
}

// PUT /api/school-billing-usage/[id] - Update specific billing usage record
export async function PUT(
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
    const updateData = await request.json();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid billing usage ID' },
        { status: 400 }
      );
    }

    // Don't allow updating school_id or month
    delete updateData.school_id;
    delete updateData.month;

    const record = await SchoolBillingUsage.findByIdAndUpdate(
      id,
      updateData,
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
    console.error('Error updating billing usage record:', error);
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: 'Failed to update billing usage record' },
        { status: 500 }
      );
    }
  }
}

// DELETE /api/school-billing-usage/[id] - Delete billing usage record
export async function DELETE(
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid billing usage ID' },
        { status: 400 }
      );
    }

    const record = await SchoolBillingUsage.findByIdAndDelete(id);

    if (!record) {
      return NextResponse.json(
        { error: 'Billing usage record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Billing usage record deleted successfully' });
  } catch (error) {
    console.error('Error deleting billing usage record:', error);
    return NextResponse.json(
      { error: 'Failed to delete billing usage record' },
      { status: 500 }
    );
  }
} 