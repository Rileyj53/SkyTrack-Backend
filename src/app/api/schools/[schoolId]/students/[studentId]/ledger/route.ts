import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import StudentLedger from '@/models/StudentLedger';
import Student from '@/models/Student';
import { School } from '@/models/School';
import mongoose from 'mongoose';
import FlightInvoice from '@/models/FlightInvoice';

// Import FlightInvoice to ensure the model is registered
import '@/models/FlightInvoice';

// Security configuration for student ledger operations
const STUDENT_LEDGER_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: false, // GET operations don't need CSRF
  allowedRoles: ['sys_admin', 'school_admin', 'instructor', 'student'],
  requireSchoolAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 100,
    windowMs: 60000,
    slidingWindow: true
  }
};

const STUDENT_LEDGER_MODIFY_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // POST/PUT operations need CSRF
  allowedRoles: ['sys_admin', 'school_admin'],
  requireSchoolAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 50,
    windowMs: 60000,
    slidingWindow: true
  }
};

const STUDENT_LEDGER_DELETE_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true,
  allowedRoles: ['sys_admin'],
  requireSchoolAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 20,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET /api/schools/[schoolId]/students/[studentId]/ledger - Get student ledger
export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing student ledger request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.studentId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid school ID or student ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Check if student exists and belongs to the school
  const student = await (Student as any).findOne({
    _id: params.studentId,
    school_id: params.schoolId
  });

  if (!student) {
    return NextResponse.json({
      error: {
        message: 'Student not found in this school',
        code: 'STUDENT_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Additional access control for students - they can only view their own ledger
  if (securityContext.user.role === 'student') {
    const studentData = student as any;
    if (!studentData.user_id || studentData.user_id.toString() !== securityContext.user.id) {
      return NextResponse.json({
        error: {
          message: 'Students can only access their own ledger',
          code: 'INSUFFICIENT_PERMISSIONS',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 403 });
    }
  }

  // Find or create student ledger
  let ledger = await (StudentLedger as any).findOne({
    school_id: params.schoolId,
    student_id: params.studentId
  })
  .populate({
    path: 'charges',
    select: 'amount description status created_at flight_schedule_id',
    populate: {
      path: 'flight_schedule_id',
      select: 'scheduled_start_time flight_type'
    }
  })
  .populate({
    path: 'payments',
    select: 'amount payment_method status created_at transaction_id'
  })
  .lean();

  // If ledger doesn't exist, create a new one
  if (!ledger) {
    const newLedger = new StudentLedger({
      school_id: params.schoolId,
      student_id: params.studentId,
      balance: 0.00,
      charges: [],
      payments: []
    });

    await newLedger.save();

    ledger = {
      _id: newLedger._id,
      school_id: params.schoolId,
      student_id: params.studentId,
      balance: 0.00,
      charges: [],
      payments: [],
      created_at: newLedger.created_at,
      updated_at: newLedger.updated_at
    };

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Created new student ledger',
      auditId: securityContext.auditId,
      studentId: params.studentId,
      ledgerId: newLedger._id,
      timestamp: new Date().toISOString()
    }));
  }

  // Parse query parameters for filtering
  const url = new URL(request.url);
  const includeTransactionHistory = url.searchParams.get('include_history') === 'true';
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');

  // Calculate summary statistics
  const totalCharges = ledger.charges?.reduce((sum: number, charge: any) => sum + (charge.amount || 0), 0) || 0;
  const totalPayments = ledger.payments?.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0) || 0;
  const pendingCharges = ledger.charges?.filter((charge: any) => charge.status === 'pending').length || 0;
  const pendingPayments = ledger.payments?.filter((payment: any) => payment.status === 'pending').length || 0;

  // Prepare response data
  const responseData: any = {
    ledger: {
      _id: ledger._id,
      school_id: ledger.school_id,
      student_id: ledger.student_id,
      balance: ledger.balance,
      created_at: ledger.created_at,
      updated_at: ledger.updated_at
    },
    summary: {
      total_charges: totalCharges,
      total_payments: totalPayments,
      current_balance: ledger.balance,
      pending_charges: pendingCharges,
      pending_payments: pendingPayments,
      charges_count: ledger.charges?.length || 0,
      payments_count: ledger.payments?.length || 0
    }
  };

  // Include transaction history if requested
  if (includeTransactionHistory) {
    let charges = ledger.charges || [];
    let payments = ledger.payments || [];

    // Apply date filtering if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start) {
        charges = charges.filter((charge: any) => new Date(charge.created_at) >= start);
        payments = payments.filter((payment: any) => new Date(payment.created_at) >= start);
      }

      if (end) {
        charges = charges.filter((charge: any) => new Date(charge.created_at) <= end);
        payments = payments.filter((payment: any) => new Date(payment.created_at) <= end);
      }
    }

    responseData.transactions = {
      charges,
      payments
    };
  }

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Student ledger retrieved successfully',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    balance: ledger.balance,
    chargesCount: ledger.charges?.length || 0,
    paymentsCount: ledger.payments?.length || 0,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Student ledger retrieved successfully',
    data: responseData,
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, STUDENT_LEDGER_SECURITY_CONFIG);

// POST /api/schools/[schoolId]/students/[studentId]/ledger - Create student ledger
export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing student ledger creation request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.studentId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid school ID or student ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Check if student exists and belongs to the school
  const student = await (Student as any).findOne({
    _id: params.studentId,
    school_id: params.schoolId
  });

  if (!student) {
    return NextResponse.json({
      error: {
        message: 'Student not found in this school',
        code: 'STUDENT_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Check if ledger already exists
  const existingLedger = await (StudentLedger as any).findOne({
    student_id: params.studentId,
    school_id: params.schoolId
  });

  if (existingLedger) {
    return NextResponse.json({
      error: {
        message: 'Student ledger already exists',
        code: 'LEDGER_ALREADY_EXISTS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 409 });
  }

  // Get request body
  const body = await request.json();

  // Validate balance (allow negative values)
  if (body.balance !== undefined && typeof body.balance !== 'number') {
    return NextResponse.json({
      error: {
        message: 'Balance must be a number',
        code: 'INVALID_BALANCE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate charges array if provided
  if (body.charges && Array.isArray(body.charges)) {
    for (const chargeId of body.charges) {
      if (!mongoose.Types.ObjectId.isValid(chargeId)) {
        return NextResponse.json({
          error: {
            message: 'Invalid charge ID in charges array',
            code: 'INVALID_CHARGE_ID',
            requestId: securityContext.auditId,
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
    }
  }

  // Validate payments array if provided
  if (body.payments && Array.isArray(body.payments)) {
    for (const payment of body.payments) {
      if (!payment.payment_id || !payment.amount || typeof payment.amount !== 'number') {
        return NextResponse.json({
          error: {
            message: 'Each payment must have payment_id and amount',
            code: 'INVALID_PAYMENT_DATA',
            requestId: securityContext.auditId,
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
      if (payment.amount < 0) {
        return NextResponse.json({
          error: {
            message: 'Payment amounts cannot be negative',
            code: 'NEGATIVE_PAYMENT_AMOUNT',
            requestId: securityContext.auditId,
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
      if (payment.timestamp && isNaN(new Date(payment.timestamp).getTime())) {
        return NextResponse.json({
          error: {
            message: 'Invalid payment timestamp format',
            code: 'INVALID_PAYMENT_TIMESTAMP',
            requestId: securityContext.auditId,
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
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
      model: 'FlightInvoice',
      select: 'total_amount status invoice_number flight_schedule_id created_at'
    })
    .lean();

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Student ledger created successfully',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    ledgerId: ledger._id,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Student ledger created successfully',
    data: { ledger: populatedLedger },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }, { status: 201 });
}, STUDENT_LEDGER_MODIFY_SECURITY_CONFIG);

// PUT /api/schools/[schoolId]/students/[studentId]/ledger - Update student ledger
export const PUT = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing student ledger update request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.studentId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid school ID or student ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find existing ledger
  const existingLedger = await (StudentLedger as any).findOne({
    student_id: params.studentId,
    school_id: params.schoolId
  });

  if (!existingLedger) {
    return NextResponse.json({
      error: {
        message: 'Student ledger not found',
        code: 'LEDGER_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Get request body
  const body = await request.json();

  // Validate balance if provided
  if (body.balance !== undefined && typeof body.balance !== 'number') {
    return NextResponse.json({
      error: {
        message: 'Balance must be a number',
        code: 'INVALID_BALANCE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate charges array if provided
  if (body.charges && Array.isArray(body.charges)) {
    for (const chargeId of body.charges) {
      if (!mongoose.Types.ObjectId.isValid(chargeId)) {
        return NextResponse.json({
          error: {
            message: 'Invalid charge ID in charges array',
            code: 'INVALID_CHARGE_ID',
            requestId: securityContext.auditId,
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
    }
  }

  // Validate payments array if provided
  if (body.payments && Array.isArray(body.payments)) {
    for (const payment of body.payments) {
      if (!payment.payment_id || !payment.amount || typeof payment.amount !== 'number') {
        return NextResponse.json({
          error: {
            message: 'Each payment must have payment_id and amount',
            code: 'INVALID_PAYMENT_DATA',
            requestId: securityContext.auditId,
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
      if (payment.amount < 0) {
        return NextResponse.json({
          error: {
            message: 'Payment amounts cannot be negative',
            code: 'NEGATIVE_PAYMENT_AMOUNT',
            requestId: securityContext.auditId,
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
      if (payment.timestamp && isNaN(new Date(payment.timestamp).getTime())) {
        return NextResponse.json({
          error: {
            message: 'Invalid payment timestamp format',
            code: 'INVALID_PAYMENT_TIMESTAMP',
            requestId: securityContext.auditId,
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
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
    model: 'FlightInvoice',
    select: 'total_amount status invoice_number flight_schedule_id created_at'
  })
  .lean();

  if (!updatedLedger) {
    return NextResponse.json({
      error: {
        message: 'Failed to update student ledger',
        code: 'UPDATE_FAILED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Student ledger updated successfully',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    ledgerId: updatedLedger._id,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Student ledger updated successfully',
    data: { ledger: updatedLedger },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, STUDENT_LEDGER_MODIFY_SECURITY_CONFIG);

// DELETE /api/schools/[schoolId]/students/[studentId]/ledger - Delete student ledger
export const DELETE = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing student ledger deletion request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.schoolId) || !mongoose.Types.ObjectId.isValid(params.studentId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid school ID or student ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find and delete the student ledger
  const deletedLedger = await (StudentLedger as any).findOneAndDelete({
    student_id: params.studentId,
    school_id: params.schoolId
  });

  if (!deletedLedger) {
    return NextResponse.json({
      error: {
        message: 'Student ledger not found',
        code: 'LEDGER_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Student ledger deleted successfully',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    ledgerId: deletedLedger._id,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Student ledger deleted successfully',
    data: { ledger_id: deletedLedger._id },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, STUDENT_LEDGER_DELETE_SECURITY_CONFIG); 