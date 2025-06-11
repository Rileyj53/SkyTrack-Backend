import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { SchoolBillingUsage } from '../../../../../models/SchoolBillingUsage';
import { connectDB } from '../../../../../lib/db';
import { authenticateRequest } from '../../../../../lib/auth';

// GET /api/school-billing-usage/school/[schoolId] - Get billing usage for specific school
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
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
    
    const { schoolId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '12'); // Default to 12 months
    
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID' },
        { status: 400 }
      );
    }

    const records = await SchoolBillingUsage
      .find({ school_id: schoolId })
      .sort({ month: -1 })
      .limit(limit);

    return NextResponse.json(records);
  } catch (error) {
    console.error('Error fetching school billing usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch school billing usage' },
      { status: 500 }
    );
  }
} 