import mongoose from 'mongoose';
import { initializeModels } from '../models';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) {
    return;
  }

  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }
    
    await mongoose.connect(mongoURI);
    isConnected = true;
    
    // Initialize models
    initializeModels();
  } catch (error) {
    console.error('Database connection error:', error.message);
    throw error;
  }
};

// Disconnect from MongoDB
export async function disconnectDB() {
  try {
    await mongoose.disconnect();
  } catch (error) {
    console.error('Database disconnection error:', error.message);
    throw error;
  }
}

// Handle connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
});

// Handle process termination
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
}); 