import mongoose from 'mongoose';
import { initializeModels } from '../models';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

// Connection options for better reliability
const connectionOptions = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  bufferMaxEntries: 0, // Disable mongoose buffering
  bufferCommands: false, // Disable mongoose buffering
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  family: 4, // Use IPv4, skip trying IPv6
  retryWrites: true, // Retry failed writes
  retryReads: true, // Retry failed reads
};

// Exponential backoff delay calculation
function calculateRetryDelay(attempt: number): number {
  const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt), MAX_RETRY_DELAY);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return Math.floor(delay + jitter);
}

// Sleep utility for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const connectDB = async (): Promise<void> => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  const mongoURI = process.env.MONGODB_URI;
  
  if (!mongoURI) {
    throw new Error('MongoDB URI is not defined in environment variables');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(`Database connection attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}`);
      
      // Close existing connection if it's in a bad state
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      
      await mongoose.connect(mongoURI, connectionOptions);
      
      // Verify connection is actually working
      await mongoose.connection.db.admin().ping();
      
      isConnected = true;
      connectionAttempts = 0;
      
      console.log('Database connected successfully');
      
      // Initialize models after successful connection
      initializeModels();
      
      return;
      
    } catch (error) {
      lastError = error as Error;
      connectionAttempts++;
      
      console.error(`Database connection attempt ${attempt + 1} failed:`, {
        error: error.message,
        attempt: attempt + 1,
        maxAttempts: MAX_RETRY_ATTEMPTS
      });
      
      // Don't retry on the last attempt
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        const delay = calculateRetryDelay(attempt);
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  // If we get here, all retry attempts failed
  const finalError = new Error(
    `Failed to connect to database after ${MAX_RETRY_ATTEMPTS} attempts. Last error: ${lastError?.message}`
  );
  
  console.error('Database connection failed permanently:', {
    attempts: MAX_RETRY_ATTEMPTS,
    lastError: lastError?.message,
    mongoURI: mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') // Hide credentials in logs
  });
  
  throw finalError;
};

// Disconnect from MongoDB with retry logic
export async function disconnectDB(): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      isConnected = false;
      console.log('Database disconnected successfully');
    }
  } catch (error) {
          console.error('Database disconnection error:', error.message);
    // Force disconnect even if there's an error
    isConnected = false;
    throw error;
  }
}

// Health check function
export async function checkDBHealth(): Promise<boolean> {
  try {
    if (!isConnected || mongoose.connection.readyState !== 1) {
      return false;
    }
    
    // Ping the database to ensure it's responsive
    await mongoose.connection.db.admin().ping();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return false;
  }
}

// Reconnection function for use in error handlers
export async function reconnectDB(): Promise<void> {
  console.log('Attempting database reconnection...');
  isConnected = false;
  await connectDB();
}

// Enhanced connection event handlers
mongoose.connection.on('error', async (err) => {
      console.error('MongoDB connection error:', {
    error: err.message,
    readyState: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  });
  
  isConnected = false;
  
  // Attempt reconnection for certain types of errors
  if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
    console.log('Network error detected, attempting reconnection...');
    try {
      await reconnectDB();
    } catch (reconnectError) {
              console.error('Reconnection failed:', reconnectError.message);
    }
  }
});

mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
  isConnected = false;
});

mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
  isConnected = true;
});

mongoose.connection.on('connected', () => {
      console.log('MongoDB connected');
  isConnected = true;
});

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, closing database connection...');
  try {
    await disconnectDB();
  } catch (error) {
    console.error('Error during graceful shutdown:', error.message);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, closing database connection...');
  try {
    await disconnectDB();
  } catch (error) {
    console.error('Error during graceful shutdown:', error.message);
  }
  process.exit(0);
}); 