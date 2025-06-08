import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import mongoose from 'mongoose';
import { User } from '@/models/User';
import Student from '@/models/Student';
import Instructor from '@/models/Instructor';
import bcrypt from 'bcryptjs';
import { generateToken } from '@/lib/jwt';

// POST /api/auth/complete-registration - Complete student registration
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }

    // Connect to database
    await connectDB();

    // Get request body
    const body = await request.json();
    const { 
      invitation_token, 
      email, 
      password, 
      first_name, 
      last_name,
      phone,
      emergency_contact
    } = body;

    // Validate required fields
    if (!invitation_token || !email || !password || !first_name || !last_name) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          required: ['invitation_token', 'email', 'password', 'first_name', 'last_name']
        },
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

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Try to find student by invitation token and email
    const student = await Student.findOne({
      invitation_token: invitation_token,
      contact_email: email.toLowerCase()
    });

    // Try to find instructor by invitation token and email
    const instructor = await Instructor.findOne({
      invitation_token: invitation_token,
      contact_email: email.toLowerCase()
    });

    // Check if either student or instructor invitation exists
    if (!student && !instructor) {
      return NextResponse.json(
        { error: 'Invalid invitation token or email' },
        { status: 404 }
      );
    }

    const invitee = student || instructor;
    const inviteeType = student ? 'student' : 'instructor';

    // Check if invitation has expired
    if (invitee.invitation_expires_at && invitee.invitation_expires_at < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired. Please request a new invitation.' },
        { status: 400 }
      );
    }

    // Check if invitee already has a user account
    if (invitee.user_id) {
      return NextResponse.json(
        { error: `This ${inviteeType} already has a user account` },
        { status: 400 }
      );
    }

    // Check if user with this email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user account with this email already exists' },
        { status: 400 }
      );
    }

    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user account
    const userData: any = {
      email: email.toLowerCase(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      password: hashedPassword,
      role: inviteeType,
      school_id: invitee.school_id,
      isActive: true,
      emailVerified: true, // Auto-verify since they came through invitation
      mfaEnabled: false,
      mfaVerified: false
    };

    // Set the appropriate ID field based on invitee type
    if (inviteeType === 'student') {
      userData.student_id = invitee._id;
    } else {
      userData.instructor_id = invitee._id;
    }

    const newUser = new User(userData);

    await newUser.save();

    // Update invitee record with user_id and clear invitation fields
    const updateData: any = {
      user_id: newUser._id
    };

    // Update phone and emergency contact if provided
    if (phone) {
      updateData.phone = phone;
    }
    if (emergency_contact) {
      updateData.emergency_contact = emergency_contact;
    }

    // Additional updates for instructors
    if (inviteeType === 'instructor') {
      updateData.status = 'Active'; // Activate instructor upon registration
    }

    // Update invitee record: set user_id and optional fields, unset invitation fields
    console.log(`About to update ${inviteeType}:`, {
      inviteeId: invitee._id,
      updateData,
      newUserId: newUser._id
    });

    const Model = inviteeType === 'student' ? Student : Instructor;
    const updatedInvitee = await Model.findByIdAndUpdate(
      invitee._id, 
      { 
        $set: updateData, 
        $unset: {
          invitation_token: "",
          invitation_sent_at: "",
          invitation_expires_at: ""
        }
      },
      { new: true }
    );

    console.log(`${inviteeType.charAt(0).toUpperCase() + inviteeType.slice(1)} update result:`, {
      success: !!updatedInvitee,
      updatedUserId: updatedInvitee?.user_id,
      inviteeId: updatedInvitee?._id
    });

    // Double-check the update by querying the database
    const verifyInvitee = await Model.findById(invitee._id);
    console.log('Verification query result:', {
      inviteeFound: !!verifyInvitee,
      userId: verifyInvitee?.user_id,
      hasInvitationToken: !!verifyInvitee?.invitation_token
    });

    if (!updatedInvitee) {
      // Cleanup: delete the user if invitee update failed
      await User.findByIdAndDelete(newUser._id);
      return NextResponse.json(
        { error: `Failed to link user account to ${inviteeType} record` },
        { status: 500 }
      );
    }

    // Generate JWT token for immediate login
    const tokenPayload: any = {
      userId: newUser._id.toString(),
      email: newUser.email,
      role: newUser.role,
      school_id: newUser.school_id?.toString()
    };

    // Add the appropriate ID field based on user type
    if (inviteeType === 'student') {
      tokenPayload.student_id = newUser.student_id?.toString();
    } else {
      tokenPayload.instructor_id = newUser.instructor_id?.toString();
    }

    const token = generateToken(tokenPayload);

    console.log(JSON.stringify({
      type: `${inviteeType}_registration_completed`,
      userId: newUser._id,
      [`${inviteeType}Id`]: invitee._id,
      email: email,
      schoolId: invitee.school_id,
      timestamp: new Date().toISOString()
    }));

    // Create response with token
    const responseData: any = {
      message: 'Account created successfully',
      user: {
        _id: newUser._id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role: newUser.role,
        school_id: newUser.school_id,
        isActive: newUser.isActive,
        emailVerified: newUser.emailVerified
      },
      token
    };

    // Add the appropriate ID field to user object
    if (inviteeType === 'student') {
      responseData.user.student_id = newUser.student_id;
      responseData.student = {
        _id: student!._id,
        contact_email: student!.contact_email,
        program: student!.program,
        status: student!.status,
        stage: student!.stage,
        nextMilestone: student!.nextMilestone
      };
    } else {
      responseData.user.instructor_id = newUser.instructor_id;
      responseData.instructor = {
        _id: instructor!._id,
        contact_email: instructor!.contact_email,
        specialties: instructor!.specialties,
        status: instructor!.status,
        hourlyRates: instructor!.hourlyRates,
        availability: instructor!.availability
      };
    }

    const response = NextResponse.json(responseData, { status: 201 });

    // Set token as httpOnly cookie for automatic login
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return response;

  } catch (error) {
    console.error('Error completing registration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/auth/complete-registration - Validate invitation token
export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }

    // Connect to database
    await connectDB();

    // Get query parameters
    const url = new URL(request.url);
    const invitation_token = url.searchParams.get('token');
    const email = url.searchParams.get('email');

    if (!invitation_token || !email) {
      return NextResponse.json(
        { error: 'Missing invitation token or email' },
        { status: 400 }
      );
    }

    // Try to find student by invitation token and email
    const student = await Student.findOne({
      invitation_token: invitation_token,
      contact_email: email.toLowerCase()
    }).populate('school_id', 'name');

    // Try to find instructor by invitation token and email
    const instructor = await Instructor.findOne({
      invitation_token: invitation_token,
      contact_email: email.toLowerCase()
    }).populate('school_id', 'name');

    // Check if either student or instructor invitation exists
    if (!student && !instructor) {
      return NextResponse.json(
        { error: 'Invalid invitation token or email' },
        { status: 404 }
      );
    }

    const invitee = student || instructor;
    const inviteeType = student ? 'student' : 'instructor';

    // Check if invitation has expired
    if (invitee.invitation_expires_at && invitee.invitation_expires_at < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Check if invitee already has a user account
    if (invitee.user_id) {
      return NextResponse.json(
        { error: `This ${inviteeType} already has a user account` },
        { status: 400 }
      );
    }

    // Return invitation details
    const responseData: any = {
      valid: true,
      type: inviteeType,
      invitation: {
        email: invitee.contact_email,
        school: invitee.school_id,
        expires_at: invitee.invitation_expires_at,
        sent_at: invitee.invitation_sent_at
      }
    };

    // Add type-specific fields
    if (inviteeType === 'student') {
      responseData.invitation.program = student!.program;
    } else {
      responseData.invitation.specialties = instructor!.specialties;
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error validating invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 