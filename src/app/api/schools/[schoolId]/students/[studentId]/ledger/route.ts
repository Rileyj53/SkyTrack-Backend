import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { verifyToken } from '@/lib/jwt';
import StudentLedger from '@/models/StudentLedger';
import Student from '@/models/Student';
import { School } from '@/models/School';
import mongoose from 'mongoose';

// Import FlightCharge to ensure the model is registered
import '@/models/FlightCharge';

/**
 * Check if user has permission to access a student's ledger
 * @param request NextRequest object to extract token from
 * @param schoolId School ID from URL
 * @param studentId Student ID from URL
 * @returns Object with permission result and error if any
 */
async function checkLedgerAccess(request: NextRequest, schoolId: string, studentId: string) {
  try {
    // Extract token from either Authorization header or cookies
    let token = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      token = request.cookies.get('token')?.value;
    }

    if (!token) {
      return { hasAccess: false, error: 'No token provided' };
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return { hasAccess: false, error: 'Invalid token' };
    }

    // System admins can access any ledger
    if (decoded.role === 'sys_admin') {
      return { hasAccess: true };
    }

    // School admins can access ledgers in their school
    if (decoded.role === 'school_admin') {
      // For now, allow school admins to access any ledger in the school they're requesting
      // In a more complex setup, you'd verify the admin actually belongs to this school
      return { hasAccess: true };
    }

    // Students can only access their own ledger
    if (decoded.role === 'student') {
      const student = await (Student as any).findOne({
        _id: studentId,
        user_id: decoded.userId,
        school_id: schoolId
      });

      if (student) {
        return { hasAccess: true };
      } else {
        return { hasAccess: false, error: 'Students can only access their own ledger' };
      }
    }

    // Instructors and other roles cannot access ledgers
    return { hasAccess: false, error: 'Insufficient permissions to access student ledger' };

  } catch (error) {
    console.error('Error checking ledger access:', error);
    return { hasAccess: false, error: 'Error validating permissions' };
  }
}

// GET /api/schools/[schoolId]/students/[studentId]/ledger - Get student ledger
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
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Connect to database
    await connectDB();

    // Check access permissions
    const accessCheck = await checkLedgerAccess(request, params.schoolId, params.studentId);
    if (!accessCheck.hasAccess) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: 403 }
      );
    }

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

    // Find the student ledger with populated data
    const ledger = await (StudentLedger as any)
      .findOne({
        student_id: params.studentId,
        school_id: params.schoolId
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
        path: 'charges',
        model: 'FlightCharge',
        select: 'amount rate_type status flight_schedule_id created_at'
      })
      .lean();

    if (!ledger) {
      return NextResponse.json(
        { error: 'Student ledger not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ledger });

  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/students/[studentId]/ledger:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/schools/[schoolId]/students/[studentId]/ledger - Create student ledger
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
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Connect to database
    await connectDB();

    // Check if user is school admin or system admin (only they can create ledgers)
    // Extract token from either Authorization header or cookies
    let token = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      token = request.cookies.get('token')?.value;
    }

    const decoded = verifyToken(token || '');
    if (decoded?.role !== 'school_admin' && decoded?.role !== 'sys_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only school administrators or system administrators can create ledgers.' },
        { status: 403 }
      );
    }

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

    // Check if ledger already exists
    const existingLedger = await StudentLedger.findOne({
      student_id: params.studentId,
      school_id: params.schoolId
    });

    if (existingLedger) {
      return NextResponse.json(
        { error: 'Student ledger already exists' },
        { status: 409 }
      );
    }

    // Get request body
    const body = await request.json();

    // Validate balance (allow negative values)
    if (body.balance !== undefined && typeof body.balance !== 'number') {
      return NextResponse.json(
        { error: 'Balance must be a number' },
        { status: 400 }
      );
    }

    // Validate charges array if provided
    if (body.charges && Array.isArray(body.charges)) {
      for (const chargeId of body.charges) {
        if (!mongoose.Types.ObjectId.isValid(chargeId)) {
          return NextResponse.json(
            { error: 'Invalid charge ID in charges array' },
            { status: 400 }
          );
        }
      }
    }

    // Validate payments array if provided
    if (body.payments && Array.isArray(body.payments)) {
      for (const payment of body.payments) {
        if (!payment.payment_id || !payment.amount || typeof payment.amount !== 'number') {
          return NextResponse.json(
            { error: 'Each payment must have payment_id and amount' },
            { status: 400 }
          );
        }
        if (payment.amount < 0) {
          return NextResponse.json(
            { error: 'Payment amounts cannot be negative' },
            { status: 400 }
          );
        }
        if (payment.timestamp && isNaN(new Date(payment.timestamp).getTime())) {
          return NextResponse.json(
            { error: 'Invalid payment timestamp format' },
            { status: 400 }
          );
        }
      }
    }

    // Create new student ledger
    const ledger = new StudentLedger({
      school_id: params.schoolId,
      student_id: params.studentId,
      balance: body.balance || 0.00,
      charges: body.charges || [],
      payments: body.payments || []
    });

    await ledger.save();

    // Populate the created ledger with related data
    const populatedLedger = await (StudentLedger as any)
      .findById(ledger._id)
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
        path: 'charges',
        model: 'FlightCharge',
        select: 'amount rate_type status flight_schedule_id created_at'
      })
      .lean();

    return NextResponse.json({
      message: 'Student ledger created successfully',
      ledger: populatedLedger
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/schools/[schoolId]/students/[studentId]/ledger:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/schools/[schoolId]/students/[studentId]/ledger - Update student ledger
export async function PUT(
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
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Connect to database
    await connectDB();

    // Check if user is school admin or system admin (only they can update ledgers)
    // Extract token from either Authorization header or cookies
    let token = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      token = request.cookies.get('token')?.value;
    }

    const decoded = verifyToken(token || '');
    if (decoded?.role !== 'school_admin' && decoded?.role !== 'sys_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only school administrators or system administrators can update ledgers.' },
        { status: 403 }
      );
    }

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.studentId)) {
      return NextResponse.json(
        { error: 'Invalid school ID or student ID format' },
        { status: 400 }
      );
    }

    // Find existing ledger
    const existingLedger = await (StudentLedger as any).findOne({
      student_id: params.studentId,
      school_id: params.schoolId
    });

    if (!existingLedger) {
      return NextResponse.json(
        { error: 'Student ledger not found' },
        { status: 404 }
      );
    }

    // Get request body
    const body = await request.json();

    // Validate balance if provided
    if (body.balance !== undefined && typeof body.balance !== 'number') {
      return NextResponse.json(
        { error: 'Balance must be a number' },
        { status: 400 }
      );
    }

    // Validate charges array if provided
    if (body.charges && Array.isArray(body.charges)) {
      for (const chargeId of body.charges) {
        if (!mongoose.Types.ObjectId.isValid(chargeId)) {
          return NextResponse.json(
            { error: 'Invalid charge ID in charges array' },
            { status: 400 }
          );
        }
      }
    }

    // Validate payments array if provided
    if (body.payments && Array.isArray(body.payments)) {
      for (const payment of body.payments) {
        if (!payment.payment_id || !payment.amount || typeof payment.amount !== 'number') {
          return NextResponse.json(
            { error: 'Each payment must have payment_id and amount' },
            { status: 400 }
          );
        }
        if (payment.amount < 0) {
          return NextResponse.json(
            { error: 'Payment amounts cannot be negative' },
            { status: 400 }
          );
        }
        if (payment.timestamp && isNaN(new Date(payment.timestamp).getTime())) {
          return NextResponse.json(
            { error: 'Invalid payment timestamp format' },
            { status: 400 }
          );
        }
      }
    }

    // Update the student ledger
    const updatedLedger = await (StudentLedger as any).findByIdAndUpdate(
      existingLedger._id,
      { $set: body },
      { new: true, runValidators: true }
    )
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
      path: 'charges',
      model: 'FlightCharge',
      select: 'amount rate_type status flight_schedule_id created_at'
    })
    .lean();

    if (!updatedLedger) {
      return NextResponse.json(
        { error: 'Failed to update student ledger' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Student ledger updated successfully',
      ledger: updatedLedger
    });

  } catch (error) {
    console.error('Error in PUT /api/schools/[schoolId]/students/[studentId]/ledger:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/schools/[schoolId]/students/[studentId]/ledger - Delete student ledger
export async function DELETE(
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
    if (authResult instanceof NextResponse) {
      return authResult;
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

    // Get user role from token for permission check
    // Extract token from either Authorization header or cookies
    let token = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      token = request.cookies.get('token')?.value;
    }

    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // Only system admins should be able to delete ledgers
    if (!isSystemAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete ledger' },
        { status: 403 }
      );
    }

    // Find and delete the student ledger
    const deletedLedger = await (StudentLedger as any).findOneAndDelete({
      student_id: params.studentId,
      school_id: params.schoolId
    });

    if (!deletedLedger) {
      return NextResponse.json(
        { error: 'Student ledger not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Student ledger deleted successfully',
      ledger_id: deletedLedger._id
    });

  } catch (error) {
    console.error('Error in DELETE /api/schools/[schoolId]/students/[studentId]/ledger:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 