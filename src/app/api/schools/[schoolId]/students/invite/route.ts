import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { checkSchoolAccess } from '@/middleware/permissions';
import { verifyToken } from '@/lib/jwt';
import { sendEmail } from '@/lib/email';
import mongoose from 'mongoose';
import Student from '@/models/Student';
import Program from '@/models/Program';
import { IProgram } from '@/models/Program';
import crypto from 'crypto';

// POST /api/schools/[schoolId]/students/invite - Invite a new student
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

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Validate school ID format
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID format' },
        { status: 400 }
      );
    }

    // Get JWT token for user info
    let token = request.headers.get('Authorization')?.split(' ')[1];
    
    if (!token) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [name, value] = cookie.trim().split('=');
          acc[name] = value;
          return acc;
        }, {} as Record<string, string>);
        
        token = cookies['token'] || cookies['jwt'] || cookies['auth-token'];
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided in Authorization header or cookies' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Check school access
    const hasAccess = await checkSchoolAccess(request, params.schoolId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this school' },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    const { email, program } = body;

    // Validate required fields
    if (!email || !program) {
      return NextResponse.json(
        { error: 'Missing required fields: email and program are required' },
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

    // Connect to database
    await connectDB();

    // Check if student with this email already exists in this school
    const existingStudent = await Student.findOne({
      school_id: params.schoolId,
      contact_email: email.toLowerCase()
    });

    if (existingStudent) {
      return NextResponse.json(
        { error: 'A student with this email already exists in this school' },
        { status: 400 }
      );
    }

    // Find the program to get requirements
    const programDoc = await (Program as any).findOne({
      school_id: params.schoolId,
      program_name: program
    }).lean() as IProgram | null;

    if (!programDoc) {
      return NextResponse.json(
        { error: 'Program not found for this school' },
        { status: 404 }
      );
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

    // Create invitation email
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/complete-registration?token=${invitationToken}&email=${encodeURIComponent(email)}`;
    
    const emailSubject = `Welcome to SkyTrack - Complete Your Account Setup`;
    const emailContent = `
      <h2>Welcome to SkyTrack Flight Training!</h2>
      <p>You have been invited to join as a student in the <strong>${program}</strong> program.</p>
      
      <p>To get started, please click the link below to create your account:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteLink}" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Complete Account Setup
        </a>
      </div>
      
      <p><strong>Program Details:</strong></p>
      <ul>
        <li><strong>Program:</strong> ${program}</li>
        <li><strong>Email:</strong> ${email}</li>
      </ul>
      
      <p><strong>What's Next?</strong></p>
      <ol>
        <li>Click the link above to create your account</li>
        <li>Set up your password and profile information</li>
        <li>Start your flight training journey!</li>
      </ol>
      
      <p><small>This invitation link will expire in 7 days. If you need a new invitation, please contact your flight school.</small></p>
      
      <hr>
      <p><small>This email was sent from SkyTrack Flight Training Management System.</small></p>
    `;

    // Send invitation email
    try {
      await sendEmail(email, emailSubject, emailContent);
      
      console.log(JSON.stringify({
        type: 'student_invitation_sent',
        studentId: student._id,
        email: email,
        program: program,
        schoolId: params.schoolId,
        invitedBy: decoded.userId,
        timestamp: new Date().toISOString()
      }));

             return NextResponse.json({
         message: 'Student invitation sent successfully',
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
           invite_link: inviteLink // For debugging - remove in production
         }
       }, { status: 201 });

    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      
      // Delete the student record if email failed
      await Student.findByIdAndDelete(student._id);
      
      return NextResponse.json({
        message: 'Failed to send invitation email',
        error: emailError.message,
        student_record_cleaned_up: true
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error creating student invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 