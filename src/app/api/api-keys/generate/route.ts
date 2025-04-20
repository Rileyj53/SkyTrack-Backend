import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { connectDB } from '@/lib/db';
import { ApiKey } from '@/models/ApiKey';
import { User } from '@/models/User';
import { generateAPIKey } from '@/lib/apiKeys';

export async function POST(request: NextRequest) {
  try {
    // Connect to the database
    await connectDB();

    // Check for authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify the token and check for sys_admin role
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check if the user has the sys_admin role
    if (decoded.role !== 'sys_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only system administrators can generate API keys' },
        { status: 403 }
      );
    }

    // Get the user from the database
    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { label, durationValue, durationType } = body;

    // Validate required fields
    if (!label || !durationValue || !durationType) {
      return NextResponse.json(
        { error: 'Missing required fields: label, durationValue, and durationType are required' },
        { status: 400 }
      );
    }

    // Validate duration type
    if (!['days', 'months', 'years'].includes(durationType)) {
      return NextResponse.json(
        { error: 'Invalid duration type. Must be one of: days, months, years' },
        { status: 400 }
      );
    }

    // Calculate expiration date
    const expirationDate = new Date();
    switch (durationType) {
      case 'days':
        expirationDate.setDate(expirationDate.getDate() + durationValue);
        break;
      case 'months':
        expirationDate.setMonth(expirationDate.getMonth() + durationValue);
        break;
      case 'years':
        expirationDate.setFullYear(expirationDate.getFullYear() + durationValue);
        break;
    }

    // Generate a new API key
    const apiKey = generateAPIKey();

    // Create a new API key document
    const newApiKey = new ApiKey({
      user_id: user._id,
      key: apiKey,
      name: label,
      created_by: user._id,
      expires_at: expirationDate
    });

    // Save the API key to the database
    await newApiKey.save();

    return NextResponse.json({
      status: 'success',
      message: 'API key generated successfully',
      data: {
        apiKey,
        label,
        expiresAt: expirationDate
      }
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 