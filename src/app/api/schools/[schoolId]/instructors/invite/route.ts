import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { checkSchoolAccess } from '@/middleware/permissions';
import { verifyToken } from '@/lib/jwt';
import { randomBytes } from 'crypto';
import Instructor from '@/models/Instructor';
import nodemailer from 'nodemailer';

// POST /api/schools/[schoolId]/instructors/invite - Invite a new instructor
export async function POST(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }

    // Authenticate request (handles both Authorization header and cookies)
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Connect to database
    await connectDB();

    // Get request body
    const body = await request.json();
    const { email, specialties = [] } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if user has access to this school
    const hasAccess = await checkSchoolAccess(request, params.schoolId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this school' },
        { status: 403 }
      );
    }

    // Check if instructor with this email already exists in this school
    const existingInstructor = await Instructor.findOne({
      school_id: params.schoolId,
      contact_email: email.toLowerCase()
    });

    if (existingInstructor) {
      return NextResponse.json(
        { error: 'An instructor with this email already exists in this school' },
        { status: 409 }
      );
    }

    // Generate secure invitation token
    const invitationToken = randomBytes(32).toString('hex');
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7); // 7 days expiration

    // Create instructor record without user_id, phone, license_number, and emergency_contact
    // These will be filled in when the instructor completes registration
    const instructorData: any = {
      school_id: params.schoolId,
      contact_email: email.toLowerCase(),
      specialties: specialties,
      status: 'Inactive', // Will be activated when they complete registration
      hourlyRates: {
        primary: 0,
        instrument: 0,
        advanced: 0,
        multiEngine: 0
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
        sunday: []
      },
      notes: '',
      documents: [],
      certifications: [],
      invitation_token: invitationToken,
      invitation_sent_at: new Date(),
      invitation_expires_at: expirationDate
    };

    const instructor = new Instructor(instructorData);

    await instructor.save();

    // Send invitation email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const registrationUrl = `${process.env.FRONTEND_URL}/complete-registration?token=${invitationToken}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: `"${process.env.ORGANIZATION_NAME || 'SkyTrack'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Flight School Instructor Invitation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You've been invited to join as a Flight Instructor!</h2>
          <p>Hello,</p>
          <p>You have been invited to join our flight school as an instructor. Please complete your registration by clicking the link below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationUrl}" 
               style="background-color: #809fff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Complete Registration
            </a>
          </div>
          <p><strong>Important:</strong> This invitation will expire in 7 days.</p>
          <p>If you have any questions, please contact the flight school administration.</p>
          <hr style="margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            If you cannot click the button above, copy and paste this link into your browser:<br>
            <a href="${registrationUrl}">${registrationUrl}</a>
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    console.log(JSON.stringify({
      type: 'instructor_invitation_sent',
      instructorId: instructor._id,
      email: email,
      schoolId: params.schoolId,
      expiresAt: expirationDate,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      message: 'Instructor invitation sent successfully',
      instructor: {
        _id: instructor._id,
        contact_email: instructor.contact_email,
        specialties: instructor.specialties,
        status: instructor.status,
        invitation_sent_at: instructor.invitation_sent_at,
        invitation_expires_at: instructor.invitation_expires_at
      },
      invitation_token: invitationToken // For debugging/testing
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating instructor invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 