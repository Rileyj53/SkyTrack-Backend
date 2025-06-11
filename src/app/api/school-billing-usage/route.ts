import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { SchoolBillingUsage } from '../../../models/SchoolBillingUsage';
import { connectDB } from '../../../lib/db';
import { authenticateRequest } from '../../../lib/auth';

// GET /api/school-billing-usage - Get all billing usage records (with optional filters)
export async function GET(request: NextRequest) {
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
    
    const { searchParams } = new URL(request.url);
    const school_id = searchParams.get('school_id');
    const month = searchParams.get('month');
    const billed = searchParams.get('billed');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    
    // Build filter object
    const filter: any = {};
    if (school_id) filter.school_id = school_id;
    if (month) filter.month = month;
    if (billed !== null) filter.billed = billed === 'true';

    const records = await SchoolBillingUsage
      .find(filter)
      .populate('school_id', 'name')
      .sort({ month: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip);

    return NextResponse.json(records);
  } catch (error) {
    console.error('Error fetching billing usage records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing usage records' },
      { status: 500 }
    );
  }
}

// POST /api/school-billing-usage - Create or update billing usage record
export async function POST(request: NextRequest) {
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
    
    const body = await request.json();
    const {
      school_id,
      month,
      total_transactions,
      stripe_transactions,
      billed,
      stripe_invoice_id
    } = body;

    // Validate required fields
    if (!school_id || !month || total_transactions === undefined || stripe_transactions === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: school_id, month, total_transactions, stripe_transactions' },
        { status: 400 }
      );
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Month must be in YYYY-MM format' },
        { status: 400 }
      );
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(school_id)) {
      return NextResponse.json(
        { error: 'Invalid school ID' },
        { status: 400 }
      );
    }

    // Try to update existing record or create new one (upsert)
    const record = await SchoolBillingUsage.findOneAndUpdate(
      { school_id, month },
      {
        school_id,
        month,
        total_transactions,
        stripe_transactions,
        billed: billed || false,
        stripe_invoice_id: stripe_invoice_id || null,
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    ).populate('school_id', 'name');

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating billing usage record:', error);
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    } else if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Billing usage record already exists for this school and month' },
        { status: 409 }
      );
    } else {
      return NextResponse.json(
        { error: 'Failed to create/update billing usage record' },
        { status: 500 }
      );
    }
  }
} 