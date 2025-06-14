import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import mongoose from 'mongoose';
import Student from '@/models/Student';
import Program from '@/models/Program';
import { IProgram } from '@/models/Program';
import { School } from '@/models/School';
import crypto from 'crypto';

// Security configuration for student invitation
const STUDENT_INVITE_SECURITY_CONFIG: SecurityConfig = {
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

// POST /api/schools/[schoolId]/students/invite - Invite a new student
export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing student invitation request',
    auditId: securityContext.auditId,
    schoolId: params.schoolId,
    userId: securityContext.user.id,
    timestamp: new Date().toISOString()
  }));

  // Validate school ID format
  if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
    return NextResponse.json({
      error: {
        message: 'Invalid school ID format',
        code: 'INVALID_SCHOOL_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Get request body
  const body = await request.json();
  const { email, program } = body;

  // Validate required fields
  if (!email || !program) {
    return NextResponse.json({
      error: {
        message: 'Missing required fields: email and program are required',
        code: 'MISSING_REQUIRED_FIELDS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({
      error: {
        message: 'Invalid email format',
        code: 'INVALID_EMAIL_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Check if student with this email already exists in this school
  const existingStudent = await (Student as any).findOne({
    school_id: params.schoolId,
    contact_email: email.toLowerCase()
  });

  if (existingStudent) {
    return NextResponse.json({
      error: {
        message: 'A student with this email already exists in this school',
        code: 'DUPLICATE_STUDENT_EMAIL',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 409 });
  }

  // Find the program to get requirements
  const programDoc = await (Program as any).findOne({
    school_id: params.schoolId,
    program_name: program
  }).lean() as IProgram | null;

  if (!programDoc) {
    return NextResponse.json({
      error: {
        message: 'Program not found for this school',
        code: 'PROGRAM_NOT_FOUND',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }

  // Generate invitation token
  const invitationToken = crypto.randomBytes(32).toString('hex');
  const invitationExpires = new Date();
  invitationExpires.setDate(invitationExpires.getDate() + 7); // Expires in 7 days

  // Initialize progress with program requirements
  const progress = {
    requirements: programDoc.requirements.map(req => ({
      name: req.name,
      total_hours: req.hours,
      completed_hours: 0,
      type: req.type
    })),
    milestones: programDoc.milestones.map(milestone => ({
      name: milestone.name,
      description: milestone.description,
      order: milestone.order,
      completed: false
    })),
    stages: programDoc.stages.map(stage => ({
      name: stage.name,
      description: stage.description,
      order: stage.order,
      completed: false
    })),
    lastUpdated: new Date()
  };

  // Create new student record without user_id
  const student = new Student({
    school_id: params.schoolId,
    // user_id is intentionally left empty
    contact_email: email.toLowerCase(),
    program,
    status: 'Active',
    stage: programDoc.stages?.[0]?.name,
    nextMilestone: programDoc.milestones?.[0]?.name,
    enrollmentDate: new Date(),
    progress,
    // Add invitation fields
    invitation_token: invitationToken,
    invitation_sent_at: new Date(),
    invitation_expires_at: invitationExpires
  });

  await student.save();

  // Get school information for personalized email
  const school = await (School as any).findById(params.schoolId).select('name');
  const schoolName = school?.name || 'Your Flight School';

  // Create invitation email
  const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/complete-registration?token=${invitationToken}&email=${encodeURIComponent(email)}`;
  
  const emailSubject = `You're Invited to ${schoolName} – Set Up Your Student Account Today`;
  const emailContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${schoolName}</title>
  </head>
  <body style="margin:0; padding:0; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height:1.6; color:#333;">
    <div style="max-width:600px; margin:0 auto; background:#fff;">
      
      <!-- Header -->
      <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding:40px 20px; text-align:center;">
        <div style="color:#fff; margin:0; font-size:28px; font-weight:300;">Welcome to</div>
        <div style="color:#fff; margin:10px 0 0; font-size:32px; font-weight:600;">${schoolName}</div>
      </div>

      <!-- Main Content -->
      <div style="padding:40px 20px;">
        
        <!-- Intro -->
        <div style="text-align:center; margin-bottom:30px;">
          <h3 style="color:#333; font-size:24px; margin-bottom:10px;">🎉 You're Officially Invited!</h3>
          <p style="color:#666; font-size:16px; margin:0;">You've been enrolled in our <strong style="color:#667eea;">${program}</strong> flight training program.</p>
        </div>
        
        <!-- Callout -->
        <div style="background-color:#f8f9fa; border-left:4px solid #667eea; padding:20px; margin:30px 0; border-radius:0 8px 8px 0;">
          <p style="margin:0; color:#555; font-size:16px;">
            <strong>Let's get started:</strong> Set up your student account to begin your aviation journey.
          </p>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align:center; margin:40px 0;">
          <a href="${inviteLink}" 
             style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color:white;
                    padding:18px 36px;
                    text-decoration:none;
                    border-radius:50px;
                    display:inline-block;
                    font-weight:600;
                    font-size:17px;
                    box-shadow:0 4px 15px rgba(102, 126, 234, 0.3);
                    transition:all 0.3s ease;">
            ✈️ Complete Account Setup
          </a>
        </div>

        <!-- Program Info -->
        <div style="background-color:#fff; border:1px solid #e9ecef; border-radius:12px; padding:25px; margin:30px 0;">
          <h4 style="color:#333; margin-top:0; font-size:18px;">📋 Program Details</h4>
          <p style="margin:8px 0; color:#666;"><strong>Program:</strong> ${program}</p>
          <p style="margin:8px 0; color:#666;"><strong>School:</strong> ${schoolName}</p>
          <p style="margin:8px 0; color:#666;"><strong>Email:</strong> ${email}</p>
        </div>

        <!-- Expiration Notice -->
        <div style="background:#fff3cd; border:1px solid #ffeaa7; border-radius:8px; padding:15px; margin:30px 0;">
          <p style="margin:0; color:#856404; font-size:14px;">
            <strong>⏰ Note:</strong> This invitation link expires in 7 days.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background:#f8f9fa; padding:30px 20px; text-align:center; border-top:1px solid #e9ecef;">
        <p style="margin:0; color:#6c757d; font-size:14px;">
          This email was sent by ${schoolName}<br>
          <span style="font-size:12px;">Powered by SkyTrack Flight Training Management System</span>
        </p>
      </div>
    </div>
  </body>
  </html>
  `;

  // Send invitation email
  try {
    await sendEmail(email, emailSubject, emailContent);
    
    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Student invitation sent successfully',
      auditId: securityContext.auditId,
      studentId: student._id,
      email: email,
      program: program,
      schoolId: params.schoolId,
      invitedBy: securityContext.user.id,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Student invitation sent successfully',
      data: {
        student: {
          _id: student._id,
          contact_email: student.contact_email,
          program: student.program,
          status: student.status,
          invitation_sent_at: student.invitation_sent_at,
          invitation_expires_at: student.invitation_expires_at
        },
        invitation: {
          token: invitationToken,
          email_sent: true,
          expires_at: invitationExpires.toISOString(),
          invite_link: process.env.NODE_ENV === 'development' ? inviteLink : undefined // Only show in development
        }
      },
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (emailError: any) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Failed to send invitation email',
      auditId: securityContext.auditId,
      error: emailError.message,
      studentId: student._id,
      timestamp: new Date().toISOString()
    }));
    
    // Delete the student record if email failed
    await (Student as any).findByIdAndDelete(student._id);
    
    return NextResponse.json({
      error: {
        message: 'Failed to send invitation email',
        code: 'EMAIL_SEND_FAILED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        details: {
          student_record_cleaned_up: true
        }
      }
    }, { status: 500 });
  }
}, STUDENT_INVITE_SECURITY_CONFIG); 