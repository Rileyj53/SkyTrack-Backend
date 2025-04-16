import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/edgeJwt';
import { generateAPIKey } from '@/lib/apiKeys';
import { createApiKeyDocument, API_KEYS_COLLECTION } from '@/models/ApiKey';
import { connectDB } from '@/lib/db';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  try {
    // Get the authorization token from the request header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid token' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // Check if the user has the admin role
    if (decoded.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create API keys' },
        { status: 403 }
      );
    }

    // Get the request body
    const body = await request.json();
    const { label, durationValue, durationType } = body;

    if (!label) {
      return NextResponse.json(
        { error: 'Bad Request: Label is required' },
        { status: 400 }
      );
    }

    // Generate a new API key
    const apiKey = generateAPIKey();
    
    // Get the last 6 characters of the actual API key for display purposes
    const lastSix = apiKey.slice(-6);
    
    // Hash the API key using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Calculate expiration date if provided
    let expiresAt: Date | undefined;
    if (durationValue && durationType) {
      const value = parseInt(durationValue);
      if (!isNaN(value) && value > 0) {
        expiresAt = new Date();
        
        // Set expiration based on duration type
        switch (durationType.toLowerCase()) {
          case 'days':
            expiresAt.setDate(expiresAt.getDate() + value);
            break;
          case 'weeks':
            expiresAt.setDate(expiresAt.getDate() + (value * 7));
            break;
          case 'months':
            expiresAt.setMonth(expiresAt.getMonth() + value);
            break;
          case 'years':
            expiresAt.setFullYear(expiresAt.getFullYear() + value);
            break;
          default:
            // Default to days if an invalid type is provided
            expiresAt.setDate(expiresAt.getDate() + value);
        }
      }
    }

    // Create the API key document with the last 6 characters of the actual key
    const apiKeyDoc = createApiKeyDocument(decoded.userId, label, hashedKey, expiresAt);
    apiKeyDoc.lastSix = lastSix; // Override the lastSix field with the actual last 6 characters

    // Connect to the database
    await connectDB();
    const db = mongoose.connection.db;

    // Insert the API key into the database
    const result = await db.collection(API_KEYS_COLLECTION).insertOne(apiKeyDoc);

    if (!result.acknowledged) {
      return NextResponse.json(
        { error: 'Failed to create API key' },
        { status: 500 }
      );
    }

    // Return the API key to the user (this is the only time the full key is returned)
    return NextResponse.json({
      success: true,
      apiKey,
      message: 'API key created successfully',
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 