import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { ApiKey } from '@/models/ApiKey';

// Connect to MongoDB
connectDB();

export async function GET(request: NextRequest) {
  try {
    // Get all API keys from database for debugging
    const apiKeys = await ApiKey.find({});
    
    return NextResponse.json({
      status: 'success',
      data: apiKeys.map(key => ({
        _id: key._id,
        user: key.user,
        label: key.label,
        key: key.key.substring(0, 10) + '...', // Only show first 10 chars for security
        lastSix: key.lastSix,
        isActive: key.isActive,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt
      }))
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 