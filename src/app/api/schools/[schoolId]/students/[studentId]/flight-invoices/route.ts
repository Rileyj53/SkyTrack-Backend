import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import FlightInvoice from '@/models/FlightInvoice';
import FlightSchedule from '@/models/FlightSchedule';
import Plane from '@/models/Plane';
import { User } from '@/models/User';
import Student from '@/models/Student';
import Instructor from '@/models/Instructor';
import { School } from '@/models/School';
import mongoose from 'mongoose';

// Security configuration for flight invoices
const FLIGHT_INVOICES_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: false, // GET operations don't need CSRF
  allowedRoles: ['sys_admin', 'school_admin', 'instructor'],
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

const FLIGHT_INVOICES_CREATE_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // POST operations need CSRF
  allowedRoles: ['sys_admin', 'school_admin', 'instructor'],
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

// GET /api/schools/[schoolId]/students/[studentId]/flight-invoices - List flight invoices for a student
export const GET = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight invoices list request',
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

  // Parse query parameters for filtering
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const status = url.searchParams.get('status');
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  const flightScheduleId = url.searchParams.get('flight_schedule_id');

  // Validate pagination parameters
  if (page < 1 || limit < 1 || limit > 200) {
    return NextResponse.json({
      error: {
        message: 'Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 200',
        code: 'INVALID_PAGINATION',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Build filter object
  const filter: any = { 
    school_id: params.schoolId,
    student_id: params.studentId
  };
  
  if (status) filter.status = status;
  if (flightScheduleId && mongoose.Types.ObjectId.isValid(flightScheduleId)) {
    filter.flight_schedule_id = flightScheduleId;
  }
  
  if (startDate || endDate) {
    filter.invoice_date = {};
    if (startDate) filter.invoice_date.$gte = new Date(startDate);
    if (endDate) filter.invoice_date.$lte = new Date(endDate);
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Get flight invoices with populated data
  const invoices = await (FlightInvoice as any)
    .find(filter)
    .populate({
      path: 'flight_schedule_id',
      select: 'scheduled_start_time scheduled_end_time actual_duration scheduled_duration flight_type status'
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
      select: 'registration type aircraftModel hourlyRates'
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
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Get total count for pagination
  const total = await FlightInvoice.countDocuments(filter);

  // Calculate summary statistics
  const summary = await (FlightInvoice as any).aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$total_amount' }
      }
    }
  ]);

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight invoices list retrieved successfully',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    invoicesCount: invoices.length,
    totalCount: total,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight invoices retrieved successfully',
    data: {
      invoices,
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
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, FLIGHT_INVOICES_SECURITY_CONFIG);

// POST /api/schools/[schoolId]/students/[studentId]/flight-invoices - Create a new flight invoice
export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight invoice creation request',
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

  // Get request body
  const body = await request.json();

  // Validate required fields
  if (!body.flight_schedule_id) {
    return NextResponse.json({
      error: {
        message: 'flight_schedule_id is required',
        code: 'MISSING_FLIGHT_SCHEDULE_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate flight schedule ID format
  if (!mongoose.Types.ObjectId.isValid(body.flight_schedule_id)) {
    return NextResponse.json({
      error: {
        message: 'Invalid flight_schedule_id format',
        code: 'INVALID_FLIGHT_SCHEDULE_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate flight schedule exists and belongs to student
  const flightSchedule = await (FlightSchedule as any).findOne({
    _id: body.flight_schedule_id,
    school_id: params.schoolId,
    student_id: params.studentId
  }).populate('plane_id');

  if (!flightSchedule) {
    return NextResponse.json({
      error: {
        message: 'Flight schedule not found for this student',
        code: 'FLIGHT_SCHEDULE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Check if invoice already exists for this flight schedule
  const existingInvoice = await (FlightInvoice as any).findOne({
    flight_schedule_id: body.flight_schedule_id
  });

  if (existingInvoice) {
    return NextResponse.json({
      error: {
        message: 'Invoice already exists for this flight schedule',
        code: 'DUPLICATE_INVOICE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 409 });
  }

  // Auto-generate line items based on flight schedule if not provided
  let lineItems = body.line_items || [];
  
  if (lineItems.length === 0) {
    lineItems = await generateDefaultLineItems(flightSchedule);
  }

  // Validate line items
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return NextResponse.json({
      error: {
        message: 'At least one line item is required',
        code: 'MISSING_LINE_ITEMS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  for (const item of lineItems) {
    if (!item.name || !item.description || typeof item.quantity !== 'number' || typeof item.unit_rate !== 'number') {
      return NextResponse.json({
        error: {
          message: 'Each line item must have name, description, quantity, and unit_rate',
          code: 'INVALID_LINE_ITEM',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
    if (item.quantity < 0 || item.unit_rate < 0) {
      return NextResponse.json({
        error: {
          message: 'Line item quantity and unit_rate cannot be negative',
          code: 'NEGATIVE_LINE_ITEM_VALUES',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }
    // Auto-calculate total for each line item (will be recalculated in pre-save hook)
    item.total_amount = item.quantity * item.unit_rate;
  }

  // Validate tax rate if provided
  if (body.tax_rate !== undefined && (typeof body.tax_rate !== 'number' || body.tax_rate < 0 || body.tax_rate > 100)) {
    return NextResponse.json({
      error: {
        message: 'Tax rate must be a number between 0 and 100',
        code: 'INVALID_TAX_RATE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate due date if provided
  if (body.due_date && isNaN(new Date(body.due_date).getTime())) {
    return NextResponse.json({
      error: {
        message: 'Invalid due_date format',
        code: 'INVALID_DUE_DATE',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Create flight invoice
  const invoice = new FlightInvoice({
    flight_schedule_id: body.flight_schedule_id,
    school_id: params.schoolId,
    student_id: params.studentId,
    plane_id: flightSchedule.plane_id._id,
    instructor_id: flightSchedule.instructor_id || undefined,
    line_items: lineItems,
    tax_rate: body.tax_rate || 0,
    currency: body.currency || 'USD',
    due_date: body.due_date ? new Date(body.due_date) : undefined,
    notes: body.notes,
    created_by: securityContext.user.id
  });

  await invoice.save();

  // Populate the created invoice with related data
  const populatedInvoice = await (FlightInvoice as any)
    .findById(invoice._id)
    .populate({
      path: 'flight_schedule_id',
      select: 'scheduled_start_time scheduled_end_time actual_duration scheduled_duration flight_type status'
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
      select: 'registration type aircraftModel hourlyRates'
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

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Flight invoice created successfully',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    invoiceId: invoice._id,
    flightScheduleId: body.flight_schedule_id,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Flight invoice created successfully',
    data: { invoice: populatedInvoice },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }, { status: 201 });
}, FLIGHT_INVOICES_CREATE_SECURITY_CONFIG);

/**
 * Generate default line items based on flight schedule and plane rates
 */
async function generateDefaultLineItems(flightSchedule: any) {
  const lineItems = [];
  const duration = flightSchedule.actual_duration || flightSchedule.scheduled_duration || 1;
  const plane = flightSchedule.plane_id;

  // Aircraft rental (wet rate includes fuel, dry rate doesn't)
  if (plane.hourlyRates?.wet) {
    lineItems.push({
      name: 'Aircraft Rental (Wet)',
      description: `${plane.registration} - Wet Rate (${duration}h)`,
      quantity: duration,
      unit_rate: plane.hourlyRates.wet,
      total_amount: duration * plane.hourlyRates.wet
    });
  } else if (plane.hourlyRates?.dry) {
    lineItems.push({
      name: 'Aircraft Rental (Dry)',
      description: `${plane.registration} - Dry Rate (${duration}h)`,
      quantity: duration,
      unit_rate: plane.hourlyRates.dry,
      total_amount: duration * plane.hourlyRates.dry
    });
  } else {
    // Default aircraft rate if no specific rates are set
    const defaultRate = 120; // Default $120/hour
    lineItems.push({
      name: 'Aircraft Rental',
      description: `${plane.registration} - Flight Time (${duration}h)`,
      quantity: duration,
      unit_rate: defaultRate,
      total_amount: duration * defaultRate
    });
  }

  // Instruction charge if instructor present
  if (flightSchedule.instructor_id) {
    const instructionRate = plane.hourlyRates?.instruction || 60; // Default $60/hour for instruction
    lineItems.push({
      name: 'Flight Instruction',
      description: `Flight Instruction (${duration}h)`,
      quantity: duration,
      unit_rate: instructionRate,
      total_amount: duration * instructionRate
    });
  }

  // Platform fee (example - 5% of total aircraft and instruction costs)
  const totalFlightCosts = lineItems.reduce((sum, item) => sum + item.total_amount, 0);
  if (totalFlightCosts > 0) {
    const platformFeeRate = 0.05; // 5%
    const platformFee = Math.round(totalFlightCosts * platformFeeRate * 100) / 100;
    lineItems.push({
      name: 'Platform Fee',
      description: `Platform Fee (${Math.round(platformFeeRate * 100)}% of flight costs)`,
      quantity: 1,
      unit_rate: platformFee,
      total_amount: platformFee
    });
  }

  return lineItems;
} 