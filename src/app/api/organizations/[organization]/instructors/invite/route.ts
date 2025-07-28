import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { randomBytes } from 'crypto';
import Instructor from '@/models/Instructor';
import { School } from '@/models/School';
import nodemailer from 'nodemailer';

// Security configuration for instructor invite endpoint
const INSTRUCTOR_INVITE_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: true, // Required for POST operations
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 20, // Lower limit for invite operations
    windowMs: 60000,
    slidingWindow: true
  }
};

// POST /api/organizations/[organizationId]/instructors/invite - Invite a new instructor
export const POST = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing instructor invitation request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Role-based access control - only admins can invite instructors
  const userRole = securityContext.user?.role;
  if (!['sys_admin', 'school_admin'].includes(userRole)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Unauthorized attempt to invite instructor',
      auditId: securityContext.auditId,
      userId: securityContext.user?.id,
      userRole: userRole,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Insufficient permissions to invite instructors',
        code: 'INSUFFICIENT_PERMISSIONS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 403 });
  }

  // Get request body
  const body = await request.json();
  const { email, specialties = [] } = body;

  // Validate required fields
  if (!email) {
    return NextResponse.json({
      error: {
        message: 'Email is required',
        code: 'MISSING_EMAIL',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid email format provided for instructor invitation',
      auditId: securityContext.auditId,
      email: email,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid email format',
        code: 'INVALID_EMAIL_FORMAT',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Check if instructor with this email already exists in this organization (still using organization_id in database for now)
  const existingInstructor = await (Instructor as any).findOne({
    organization_id: params.organization,
    contact_email: email.toLowerCase(),
  });

  if (existingInstructor) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Instructor with email already exists in organization',
      auditId: securityContext.auditId,
      email: email,
      organizationId: params.organization,
      existingInstructorId: existingInstructor._id,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'An instructor with this email already exists in this organization',
        code: 'INSTRUCTOR_EXISTS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 409 });
  }

  // Get organization information for personalized email (still using School model for now)
  const organization = await (School as any).findById(params.organization).select('name');
  const organizationName = organization?.name || 'Your Flight Organization';

  // Generate secure invitation token
  const invitationToken = randomBytes(32).toString('hex');
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 7); // 7 days expiration

  // Create instructor record without user_id, phone, license_number, and emergency_contact
  // These will be filled in when the instructor completes registration
  const instructorData: any = {
    organization_id: params.organization, // Still using organization_id in database for now
    contact_email: email.toLowerCase(),
    specialties: specialties,
    status: 'Inactive', // Will be activated when they complete registration
    hourlyRates: {
      primary: 0,
      instrument: 0,
      advanced: 0,
      multiEngine: 0,
    },
    flightHours: 0,
    teachingHours: 0,
    availability: 'Full-time',
    students: 0,
    utilization: 0,
    ratings: [],
    availability_time: {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    },
    notes: '',
    documents: [],
    certifications: [],
    invitation_token: invitationToken,
    invitation_sent_at: new Date(),
    invitation_expires_at: expirationDate,
  };

  const instructor = new Instructor(instructorData);
  await instructor.save();

  // Send invitation email
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const registrationUrl = `${process.env.FRONTEND_URL}/complete-registration?token=${invitationToken}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: `"${organizationName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: `Welcome to ${organizationName} - Flight Instructor Invitation`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${organizationName}</title>
</head>
<body style="margin:0; padding:0; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height:1.6; color:#333;">
  <div style="max-width:600px; margin:0 auto; background:#fff;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg, #2c5530 0%, #4a7c59 100%); padding:40px 20px; text-align:center;">
      <div style="color:white; font-size:28px; font-weight:300;">Welcome to</div>
      <div style="color:white; font-size:32px; font-weight:600; margin-top:10px;">${organizationName}</div>
    </div>

    <!-- Main Content -->
    <div style="padding:40px 20px;">
      
      <!-- Intro -->
      <div style="text-align:center; margin-bottom:30px;">
        <h3 style="color:#333; font-size:24px; margin-bottom:10px;">🎖️ You've Been Invited to Join Our Instructor Team</h3>
        <p style="color:#666; font-size:16px; margin:0;">
          We're excited to welcome you as a flight instructor at <strong style="color:#2c5530;">${organizationName}</strong>. Your aviation experience is vital to helping train and mentor the next generation of pilots.
        </p>
      </div>
      
      <!-- Callout -->
      <div style="background-color:#f8f9fa; border-left:4px solid #2c5530; padding:20px; margin:30px 0; border-radius:0 8px 8px 0;">
        <p style="margin:0; color:#555; font-size:16px;">
          <strong>Let's get started:</strong> Click below to create your instructor account and begin onboarding.
        </p>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align:center; margin:40px 0;">
        <a href="${registrationUrl}" 
           style="background:linear-gradient(135deg, #2c5530 0%, #4a7c59 100%);
                  color:white;
                  padding:18px 36px;
                  text-decoration:none;
                  border-radius:50px;
                  display:inline-block;
                  font-weight:600;
                  font-size:17px;
                  box-shadow:0 4px 15px rgba(44, 85, 48, 0.3);
                  transition:all 0.3s ease;">
          ✈️ Complete Instructor Registration
        </a>
      </div>

      <!-- Instructor Details -->
      <div style="background-color:#fff; border:1px solid #e9ecef; border-radius:12px; padding:25px; margin:30px 0;">
        <h4 style="color:#333; margin-top:0; font-size:18px;">📋 Instructor Details</h4>
        <p style="margin:8px 0; color:#666;"><strong>Email:</strong> ${email}</p>
        <p style="margin:8px 0; color:#666;"><strong>Organization:</strong> ${organizationName}</p>
        ${specialties.length > 0 ? `<p style="margin:8px 0; color:#666;"><strong>Specialties:</strong> ${specialties.join(', ')}</p>` : ''}
      </div>

      <!-- Expiration Note -->
      <div style="background-color:#fff3cd; border:1px solid #ffeaa7; border-radius:8px; padding:15px; margin:30px 0;">
        <p style="margin:0; color:#856404; font-size:14px;">
          <strong>⏰ Note:</strong> This invitation link will expire in 7 days.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa; padding:30px 20px; text-align:center; border-top:1px solid #e9ecef;">
      <p style="margin:0; color:#6c757d; font-size:14px;">
        This email was sent by ${organizationName}<br>
        <span style="font-size:12px;">Powered by SkyTrack Flight Training Management System</span>
      </p>
    </div>
  </div>
</body>
</html>
`,
    };

    await transporter.sendMail(mailOptions);

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Instructor invitation email sent successfully',
      auditId: securityContext.auditId,
      instructorId: instructor._id,
      email: email,
      organizationId: params.organization,
      expiresAt: expirationDate,
      sentBy: securityContext.user?.id,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }));

  } catch (emailError) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Failed to send instructor invitation email',
      auditId: securityContext.auditId,
      instructorId: instructor._id,
      email: email,
      error: emailError.message,
      timestamp: new Date().toISOString()
    }));

    // Delete the instructor record if email failed
    await (Instructor as any).findByIdAndDelete(instructor._id);

    return NextResponse.json({
      error: {
        message: 'Failed to send invitation email',
        code: 'EMAIL_SEND_FAILED',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Instructor invitation created successfully',
    auditId: securityContext.auditId,
    instructorId: instructor._id,
    email: email,
    organizationId: params.organization,
    createdBy: securityContext.user?.id,
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  }));

  return NextResponse.json({
    success: true,
    message: 'Instructor invitation sent successfully',
    data: {
      instructor: {
        _id: instructor._id,
        contact_email: instructor.contact_email,
        specialties: instructor.specialties,
        status: instructor.status,
        invitation_sent_at: instructor.invitation_sent_at,
        invitation_expires_at: instructor.invitation_expires_at,
      },
      invitation_token: invitationToken, // For debugging/testing
    },
    auditId: securityContext.auditId,
    timestamp: new Date().toISOString()
  }, { status: 201 });
}, INSTRUCTOR_INVITE_SECURITY_CONFIG);
