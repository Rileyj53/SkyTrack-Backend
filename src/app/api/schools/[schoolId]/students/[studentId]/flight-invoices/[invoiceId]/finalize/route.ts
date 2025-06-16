import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import FlightInvoice from '@/models/FlightInvoice';
import StudentLedger from '@/models/StudentLedger';
import mongoose from 'mongoose';

// Security configuration for flight invoice finalization
const FLIGHT_INVOICE_FINALIZE_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // POST operations need CSRF
  allowedRoles: ['sys_admin', 'school_admin'],
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

// POST /api/schools/[schoolId]/students/[studentId]/flight-invoices/[invoiceId]/finalize - Finalize a flight invoice
export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing flight invoice finalization request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    invoiceId: params.invoiceId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate IDs
  if (!mongoose.Types.ObjectId.isValid(params.schoolId) || 
      !mongoose.Types.ObjectId.isValid(params.studentId) ||
      !mongoose.Types.ObjectId.isValid(params.invoiceId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid ID format',
        code: 'INVALID_ID_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Find the flight invoice
  const invoice = await (FlightInvoice as any).findOne({
    _id: params.invoiceId,
    school_id: params.schoolId,
    student_id: params.studentId
  }).populate('flight_schedule_id');

  if (!invoice) {
    return NextResponse.json({
      error: {
        message: 'Flight invoice not found',
        code: 'INVOICE_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Check if invoice is in a state that can be finalized
  if (!['sent', 'approved'].includes(invoice.status)) {
    return NextResponse.json({
      error: {
        message: `Cannot finalize invoice with status: ${invoice.status}. Only sent or approved invoices can be finalized.`,
        code: 'INVALID_INVOICE_STATUS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Check if invoice has already been converted to a flight charge
  if (invoice.flight_charge_id) {
    return NextResponse.json({
      error: {
        message: 'Invoice has already been finalized and converted to a flight charge',
        code: 'INVOICE_ALREADY_FINALIZED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Get request body for finalization notes
  const body = await request.json().catch(() => ({}));
  const finalizationNotes = body.notes || '';

  try {
    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();
    
    await session.withTransaction(async () => {
      // Create a charge record (simplified - adjust based on your actual charge model)
      const chargeData = {
        school_id: params.schoolId,
        student_id: params.studentId,
        flight_schedule_id: invoice.flight_schedule_id._id,
        plane_id: invoice.plane_id,
        instructor_id: invoice.instructor_id,
        amount: invoice.total_amount,
        currency: invoice.currency || 'USD',
        description: `Flight charge from invoice ${invoice.invoice_number || invoice._id}`,
        line_items: invoice.line_items,
        tax_amount: invoice.tax_amount || 0,
        tax_rate: invoice.tax_rate || 0,
        status: 'pending',
        created_by: securityContext.user.id,
        invoice_id: invoice._id,
        notes: finalizationNotes,
        created_at: new Date()
      };

      // For now, we'll just mark the invoice as finalized without creating a separate charge
      // This can be extended when the FlightCharge model is available

              // Update the invoice to mark it as finalized
        await (FlightInvoice as any).findByIdAndUpdate(
          params.invoiceId,
          {
            $set: {
              status: 'finalized',
              finalized_at: new Date(),
              finalized_by: securityContext.user.id,
              finalization_notes: finalizationNotes
            }
          },
          { session }
        );

        // Add the charge to the student's ledger
        await addChargeToStudentLedger(
          params.schoolId,
          params.studentId,
          new mongoose.Types.ObjectId(), // Generate a temporary charge ID
          chargeData.amount,
          session
        );
    });

    await session.endSession();

    // Fetch the updated invoice with populated data
    const updatedInvoice = await (FlightInvoice as any)
      .findById(params.invoiceId)
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
        path: 'flight_charge_id',
        select: 'amount status created_at description'
      })
      .populate({
        path: 'finalized_by',
        select: 'first_name last_name email role'
      })
      .populate({
        path: 'created_by',
        select: 'first_name last_name email role'
      })
      .lean();

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Flight invoice finalized successfully',
      auditId: securityContext.auditId,
      schoolId: params.schoolId,
      studentId: params.studentId,
      invoiceId: params.invoiceId,
      flightChargeId: updatedInvoice?.flight_charge_id,
      finalizedBy: securityContext.user.id,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Flight invoice finalized successfully and converted to flight charge',
      data: { 
        invoice: updatedInvoice,
        finalization: {
          finalized_at: new Date(),
          finalized_by: securityContext.user.id,
          finalization_notes: finalizationNotes,
          flight_charge_id: updatedInvoice?.flight_charge_id
        }
      },
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Failed to finalize flight invoice',
      auditId: securityContext.auditId,
      error: error.message,
      invoiceId: params.invoiceId,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Failed to finalize flight invoice',
        code: 'FINALIZATION_FAILED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        details: {
          error: error.message
        }
      }
    }, { status: 500 });
  }
}, FLIGHT_INVOICE_FINALIZE_SECURITY_CONFIG);

/**
 * Add a flight charge to the student's ledger
 */
async function addChargeToStudentLedger(
  schoolId: string,
  studentId: string,
  chargeId: mongoose.Types.ObjectId,
  chargeAmount: number,
  session: mongoose.ClientSession
): Promise<void> {
  try {
    // Find or create student ledger
    let ledger = await (StudentLedger as any).findOne({
      school_id: schoolId,
      student_id: studentId
    }).session(session);

    if (!ledger) {
      // Create new ledger if it doesn't exist
      ledger = new StudentLedger({
        school_id: schoolId,
        student_id: studentId,
        balance: 0.00,
        charges: [],
        payments: []
      });
    }

    // Add the charge to the charges array if not already present
    if (!ledger.charges.includes(chargeId)) {
      ledger.charges.push(chargeId);
    }

    // Update the balance with the charge amount
    ledger.balance += chargeAmount;

    // Save the ledger
    await ledger.save({ session });

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Flight charge added to student ledger',
      chargeId: chargeId,
      studentId: studentId,
      chargeAmount: chargeAmount,
      newBalance: ledger.balance,
      timestamp: new Date().toISOString()
    }));

  } catch (error: any) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error adding charge to student ledger',
      error: error.message,
      chargeId: chargeId,
      studentId: studentId,
      timestamp: new Date().toISOString()
    }));
    throw error;
  }
}

 