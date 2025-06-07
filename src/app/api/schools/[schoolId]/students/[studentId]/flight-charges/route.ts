import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import FlightCharge from '@/models/FlightCharge';
import FlightSchedule from '@/models/FlightSchedule';
import Student from '@/models/Student';
import StudentLedger from '@/models/StudentLedger';
import { School } from '@/models/School';
import mongoose from 'mongoose';

// GET /api/schools/[schoolId]/students/[studentId]/flight-charges - List flight charges for a student
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string; studentId: string } }
) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if ('error' in apiKeyResult) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 });
    }

    // Authenticate user
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Connect to database
    await connectDB();

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.studentId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or student ID format' },
        { status: 400 }
      );
    }

    // Check if student exists and belongs to the school
    const student = await (Student as any).findOne({
      _id: params.studentId,
      school_id: params.schoolId
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found in this school' },
        { status: 404 }
      );
    }

    // Parse query parameters for filtering
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const status = url.searchParams.get('status');
    const rateType = url.searchParams.get('rate_type');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const flightScheduleId = url.searchParams.get('flight_schedule_id');

    // Build filter object
    const filter: any = { 
      school_id: params.schoolId,
      student_id: params.studentId
    };
    
    if (status) filter.status = status;
    if (rateType) filter.rate_type = rateType;
    if (flightScheduleId && mongoose.Types.ObjectId.isValid(flightScheduleId)) {
      filter.flight_schedule_id = flightScheduleId;
    }
    
    if (startDate || endDate) {
      filter.created_at = {};
      if (startDate) filter.created_at.$gte = new Date(startDate);
      if (endDate) filter.created_at.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get flight charges with populated data
    const charges = await (FlightCharge as any)
      .find(filter)
      .populate({
        path: 'flight_schedule_id',
        select: 'scheduled_start_time scheduled_end_time flight_type status'
      })
      .populate({
        path: 'school_id',
        select: 'name address airport phone email'
      })
      .populate({
        path: 'student_id',
        populate: {
          path: 'user_id',
          select: 'first_name last_name email'
        }
      })
      .populate({
        path: 'plane_id',
        select: 'registration type aircraftModel'
      })
      .populate({
        path: 'instructor_id',
        populate: {
          path: 'user_id',
          select: 'first_name last_name email'
        }
      })
      .populate({
        path: 'created_by',
        select: 'first_name last_name email role'
      })
      .populate({
        path: 'approved_by',
        select: 'first_name last_name email role'
      })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await FlightCharge.countDocuments(filter);

    // Calculate summary statistics
    const summary = await (FlightCharge as any).aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    return NextResponse.json({
      charges,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      summary: summary.reduce((acc: any, item: any) => {
        acc[item._id] = {
          count: item.count,
          totalAmount: item.totalAmount
        };
        return acc;
      }, {})
    });

  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/students/[studentId]/flight-charges:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/schools/[schoolId]/students/[studentId]/flight-charges - Create a new flight charge
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string; studentId: string } }
) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if ('error' in apiKeyResult) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 });
    }

    // Authenticate user
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Connect to database
    await connectDB();

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.studentId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or student ID format' },
        { status: 400 }
      );
    }

    // Check if student exists and belongs to the school
    const student = await (Student as any).findOne({
      _id: params.studentId,
      school_id: params.schoolId
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found in this school' },
        { status: 404 }
      );
    }

    // Get request body
    const body = await request.json();

    // Get current user from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    if (!decoded?.userId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Validate required fields
    const requiredFields = ['flight_schedule_id', 'plane_id', 'duration', 'rate_type', 'amount'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Validate ObjectId fields
    const objectIdFields = ['flight_schedule_id', 'plane_id'];
    for (const field of objectIdFields) {
      if (!mongoose.Types.ObjectId.isValid(body[field])) {
        return NextResponse.json(
          { error: `Invalid ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate instructor_id if provided
    if (body.instructor_id && !mongoose.Types.ObjectId.isValid(body.instructor_id)) {
      return NextResponse.json(
        { error: 'Invalid instructor_id' },
        { status: 400 }
      );
    }

    // Validate numeric fields
    if (typeof body.duration !== 'number' || body.duration < 0) {
      return NextResponse.json(
        { error: 'Duration must be a non-negative number' },
        { status: 400 }
      );
    }

    if (typeof body.amount !== 'number') {
      return NextResponse.json(
        { error: 'Amount must be a number' },
        { status: 400 }
      );
    }

    if (body.rate_override !== undefined && (typeof body.rate_override !== 'number' || body.rate_override < 0)) {
      return NextResponse.json(
        { error: 'Rate override must be a non-negative number' },
        { status: 400 }
      );
    }

    // Validate flight schedule exists
    const flightSchedule = await (FlightSchedule as any).findOne({
      _id: body.flight_schedule_id,
      school_id: params.schoolId,
      student_id: params.studentId
    });

    if (!flightSchedule) {
      return NextResponse.json(
        { error: 'Flight schedule not found for this student' },
        { status: 404 }
      );
    }

    // Create new flight charge
    const flightCharge = new FlightCharge({
      flight_schedule_id: body.flight_schedule_id,
      school_id: params.schoolId,
      student_id: params.studentId,
      plane_id: body.plane_id,
      instructor_id: body.instructor_id || undefined,
      duration: body.duration,
      rate_type: body.rate_type,
      rate_override: body.rate_override || undefined,
      simulator: body.simulator || false,
      amount: body.amount,
      currency: body.currency || 'USD',
      status: body.status || 'pending',
      created_by: decoded.userId
    });

    await flightCharge.save();

    // INTEGRATION: Add charge to student ledger
    try {
      await addChargeToStudentLedger(params.schoolId, params.studentId, flightCharge._id, flightCharge.amount);
    } catch (ledgerError) {
      console.error('Error adding charge to student ledger:', ledgerError);
      // Don't fail the charge creation if ledger update fails, but log it
      console.warn(`Flight charge ${flightCharge._id} created but failed to update student ledger for student ${params.studentId}`);
    }

    // Populate the created charge with related data
    const populatedCharge = await (FlightCharge as any)
      .findById(flightCharge._id)
      .populate({
        path: 'flight_schedule_id',
        select: 'scheduled_start_time scheduled_end_time flight_type status'
      })
      .populate({
        path: 'school_id',
        select: 'name address airport phone email'
      })
      .populate({
        path: 'student_id',
        populate: {
          path: 'user_id',
          select: 'first_name last_name email'
        }
      })
      .populate({
        path: 'plane_id',
        select: 'registration type aircraftModel'
      })
      .populate({
        path: 'instructor_id',
        populate: {
          path: 'user_id',
          select: 'first_name last_name email'
        }
      })
      .populate({
        path: 'created_by',
        select: 'first_name last_name email role'
      })
      .lean();

    return NextResponse.json({
      message: 'Flight charge created successfully and added to student ledger',
      charge: populatedCharge
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/schools/[schoolId]/students/[studentId]/flight-charges:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Add a flight charge to the student's ledger, creating the ledger if it doesn't exist
 * NOTE: Pending charges are added to charges array but do NOT affect balance
 */
async function addChargeToStudentLedger(
  schoolId: string, 
  studentId: string, 
  chargeId: mongoose.Types.ObjectId, 
  chargeAmount: number
): Promise<void> {
  try {
    // Try to find existing ledger
    let ledger = await (StudentLedger as any).findOne({
      school_id: schoolId,
      student_id: studentId
    });

    if (!ledger) {
      // Create new ledger if it doesn't exist
      console.log(`Creating new ledger for student ${studentId} in school ${schoolId}`);
      ledger = new StudentLedger({
        school_id: schoolId,
        student_id: studentId,
        balance: 0.00,
        charges: [],
        payments: []
      });
    }

    // Add the charge to the charges array (but NOT to balance - only approved charges affect balance)
    if (!ledger.charges.includes(chargeId)) {
      ledger.charges.push(chargeId);
    }

    // DO NOT update balance here - only approved charges affect balance

    // Save the ledger
    await ledger.save();

    console.log(`Successfully added pending charge ${chargeId} (amount: ${chargeAmount}) to charges array for student ${studentId}. Balance unchanged: ${ledger.balance}`);

  } catch (error) {
    console.error('Error in addChargeToStudentLedger:', error);
    throw error; // Re-throw to be handled by calling function
  }
} 