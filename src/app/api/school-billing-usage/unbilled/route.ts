import { NextRequest, NextResponse } from 'next/server';
import { SchoolBillingUsage } from '../../../../models/SchoolBillingUsage';
import { connectDB } from '../../../../lib/db';
import { authenticateRequest } from '../../../../lib/auth';

// GET /api/school-billing-usage/unbilled - Get all unbilled records
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
    
    const records = await SchoolBillingUsage
      .find({ billed: false })
      .populate('school_id', 'name')
      .sort({ month: -1, createdAt: -1 });

    return NextResponse.json(records);
  } catch (error) {
    console.error('Error fetching unbilled records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unbilled records' },
      { status: 500 }
    );
  }
} 