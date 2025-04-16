import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { API_KEYS_COLLECTION } from '@/models/ApiKey';
import mongoose from 'mongoose';

// Specify Node.js runtime
export const runtime = 'nodejs';

// Connect to MongoDB
connectDB();

export async function validateApiKey(request: NextRequest) {
  try {
    // Get API key from header
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 401 }
      );
    }

    // Ensure we have a valid connection
    if (!mongoose.connection || !mongoose.connection.db) {
      console.error('Database connection error');
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      );
    }

    // Hash the incoming API key
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Find API key in database using the hashed key
    const apiKeyDoc = await mongoose.connection.db.collection(API_KEYS_COLLECTION).findOne({ 
      key: hashedKey,
      isActive: true
    });

    if (!apiKeyDoc) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Update last used timestamp
    await mongoose.connection.db.collection(API_KEYS_COLLECTION).updateOne(
      { _id: apiKeyDoc._id },
      { $set: { lastUsedAt: new Date() } }
    );

    return {
      userId: apiKeyDoc.user,
      apiKeyDoc
    };
  } catch (error) {
    console.error('API key validation error:', error);
    return NextResponse.json(
      { error: 'Error validating API key' },
      { status: 500 }
    );
  }
} 