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
import { School } from '@/models/School';
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
    const existingStudent = await (Student as any).findOne({
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
            <p style="color:#666; font-size:16px; margin:0;">You’ve been enrolled in our <strong style="color:#667eea;">${program}</strong> flight training program.</p>
          </div>
          
          <!-- Callout -->
          <div style="background-color:#f8f9fa; border-left:4px solid #667eea; padding:20px; margin:30px 0; border-radius:0 8px 8px 0;">
            <p style="margin:0; color:#555; font-size:16px;">
              <strong>Let’s get started:</strong> Set up your student account to begin your aviation journey.
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
      await (Student as any).findByIdAndDelete(student._id);
      
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