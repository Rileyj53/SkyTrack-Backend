import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import StudentLedger from '@/models/StudentLedger';
import Student from '@/models/Student';
import FlightInvoice from '@/models/FlightInvoice';
import mongoose from 'mongoose';

// Security configuration for ledger recalculation
const LEDGER_RECALCULATE_SECURITY_CONFIG: SecurityConfig = {
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

// POST /api/schools/[schoolId]/students/[studentId]/ledger/recalculate - Recalculate student ledger balance
export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing ledger recalculation request',
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

  // Find the student's ledger
  const ledger = await (StudentLedger as any).findOne({
    school_id: params.schoolId,
    student_id: params.studentId
  });

  if (!ledger) {
    return NextResponse.json({
      error: {
        message: 'Ledger not found for this student',
        code: 'LEDGER_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Get all approved flight invoices for this student
  const allApprovedInvoices = await (FlightInvoice as any).find({
    school_id: params.schoolId,
    student_id: params.studentId,
    status: 'approved'
  });

  // Calculate new balance from scratch based on approved invoices
  const chargeAmount = allApprovedInvoices.reduce((total: number, invoice: any) => {
    return total + (invoice.total_amount || 0);
  }, 0);
  
  // Calculate payment amount from existing payments in ledger
  const paymentAmount = ledger.payments.reduce((total: number, payment: any) => {
    return total + (payment.amount || 0);
  }, 0);

  const oldBalance = ledger.balance;
  const newBalance = chargeAmount - paymentAmount;
  const difference = newBalance - oldBalance;

  // Update the ledger
  ledger.balance = newBalance;
  ledger.last_updated = new Date();
  await ledger.save();

  const processingTime = Date.now() - startTime;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Ledger balance recalculated successfully',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    studentId: params.studentId,
    oldBalance,
    newBalance,
    difference,
    approvedInvoicesCount: allApprovedInvoices.length,
    processingTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Ledger balance recalculated successfully',
    data: {
      recalculation: {
        old_balance: oldBalance,
        new_balance: newBalance,
        difference,
        approved_invoices_count: allApprovedInvoices.length,
        total_charges_in_ledger: (ledger.charges || []).length,
        recalculated_at: new Date()
      }
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  });
}, LEDGER_RECALCULATE_SECURITY_CONFIG); 