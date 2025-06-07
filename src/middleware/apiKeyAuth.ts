import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { ApiKey } from '@/models/ApiKey';
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
      console.log('No API key provided in X-API-Key header');
      return { error: 'API key is required' };
    }

    console.log('API key received:', apiKey.substring(0, 10) + '...');

    // Ensure we have a valid connection
    if (!mongoose.connection || !mongoose.connection.db) {
      console.error('Database connection error');
      return { error: 'Database connection error' };
    }

    // Hash the incoming API key
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log('Hashed key:', hashedKey.substring(0, 10) + '...');

    // Find API key in database using the hashed key
    const apiKeyDoc = await ApiKey.findOne({ 
      key: hashedKey,
      isActive: true
    });

    if (!apiKeyDoc) {
      console.log('API key not found in database or inactive');
      return { error: 'Invalid API key' };
    }

    console.log('API key found in database');

    // Check if API key has expired
    if (apiKeyDoc.expiresAt && new Date() > new Date(apiKeyDoc.expiresAt)) {
      console.log('API key has expired');
      return { error: 'API key has expired' };
    }

    console.log('API key validation successful');

    // Update last used timestamp
    await ApiKey.updateOne(
      { _id: apiKeyDoc._id },
      { $set: { lastUsedAt: new Date() } }
    );

    return {
      userId: apiKeyDoc.user,
      apiKeyDoc
    };
  } catch (error) {
    console.error('API key validation error:', error);
    return { error: 'Error validating API key' };
  }
} 