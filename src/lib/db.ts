import mongoose from 'mongoose';
import { initializeModels } from '../models';

// Connection state management
let connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
let connectionPromise: Promise<void> | null = null;
let connectionAttempts = 0;
let lastConnectionError: Error | null = null;

const MAX_RETRY_ATTEMPTS = 3; // Reduced from 5 for faster failure
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRY_DELAY = 10000; // 10 seconds

// Optimized connection options for stability
const connectionOptions = {
  // Connection pool settings
  maxPoolSize: 5, // Reduced pool size for development
  minPoolSize: 1, // Maintain minimum connections
  maxIdleTimeMS: 60000, // 1 minute idle timeout
  
  // Timeout settings
  serverSelectionTimeoutMS: 10000, // 10 seconds to select server
  socketTimeoutMS: 45000, // 45 seconds socket timeout
  connectTimeoutMS: 10000, // 10 seconds connection timeout
  
  // Behavioral settings
  bufferCommands: false, // Disable mongoose buffering for immediate errors
  
  // Network settings
  family: 4, // IPv4 only
  retryWrites: true,
  retryReads: true,
  
  // Development specific
  autoIndex: true, // Build indexes in development
  autoCreate: true, // Create collections automatically
};

// Exponential backoff with jitter
function calculateRetryDelay(attempt: number): number {
  const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt), MAX_RETRY_DELAY);
  const jitter = Math.random() * 0.1 * delay;
  return Math.floor(delay + jitter);
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize event handlers once
let eventHandlersInitialized = false;

function initializeEventHandlers(): void {
  if (eventHandlersInitialized) return;
  eventHandlersInitialized = true;

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
    connectionState = 'connected';
    connectionAttempts = 0;
    lastConnectionError = null;
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
    connectionState = 'error';
    lastConnectionError = err;
  });

  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
    if (connectionState !== 'connecting') {
      connectionState = 'disconnected';
    }
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
    connectionState = 'connected';
    connectionAttempts = 0;
    lastConnectionError = null;
  });

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    console.log(`🛑 Received ${signal}, closing database connection...`);
    try {
      await disconnectDB();
      console.log('Database connection closed successfully');
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

export const connectDB = async (): Promise<void> => {
  // Initialize event handlers
  initializeEventHandlers();

  // Return existing connection if already connected
  if (connectionState === 'connected' && mongoose.connection.readyState === 1) {
    return;
  }

  // Return existing connection promise if currently connecting
  if (connectionState === 'connecting' && connectionPromise) {
    return connectionPromise;
  }

  // Create new connection promise
  connectionPromise = performConnection();
  return connectionPromise;
};

async function performConnection(): Promise<void> {
  connectionState = 'connecting';
  
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    const error = new Error('MongoDB URI is not defined in environment variables');
    connectionState = 'error';
    lastConnectionError = error;
    throw error;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(`Database connection attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}`);
      
      // Only disconnect if we're in a bad state (not on first attempt)
      if (attempt > 0 && mongoose.connection.readyState !== 0) {
        console.log('Closing existing connection before retry...');
        await mongoose.disconnect();
        await sleep(1000); // Brief pause after disconnect
      }
      
      // Attempt connection
      await mongoose.connect(mongoURI, connectionOptions);
      
      // Verify connection with ping
      await mongoose.connection.db.admin().ping();
      
      // Connection successful
      connectionState = 'connected';
      connectionAttempts = 0;
      lastConnectionError = null;
      
      console.log('Database connected successfully');
      
      // Initialize models after successful connection
      try {
        initializeModels();
        console.log('Database models initialized');
      } catch (modelError) {
        console.warn('Model initialization warning:', modelError.message);
        // Don't fail connection for model initialization issues
      }
      
      return;
      
    } catch (error) {
      lastError = error as Error;
      connectionAttempts++;
      
      console.error(`Database connection attempt ${attempt + 1} failed:`, {
        error: error.message,
        attempt: attempt + 1,
        maxAttempts: MAX_RETRY_ATTEMPTS,
        readyState: mongoose.connection.readyState
      });
      
      // Wait before retry (except on last attempt)
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        const delay = calculateRetryDelay(attempt);
        console.log(`Retrying connection in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  // All attempts failed
  connectionState = 'error';
  lastConnectionError = lastError;
  
  const finalError = new Error(
    `Failed to connect to database after ${MAX_RETRY_ATTEMPTS} attempts. Last error: ${lastError?.message}`
  );
  
  console.error('Database connection failed permanently:', {
    attempts: MAX_RETRY_ATTEMPTS,
    lastError: lastError?.message,
    readyState: mongoose.connection.readyState,
    mongoURI: mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
  });
  
  throw finalError;
}

// Disconnect from MongoDB
export async function disconnectDB(): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('Database disconnected successfully');
    }
    connectionState = 'disconnected';
    connectionPromise = null;
  } catch (error) {
    console.error('Database disconnection error:', error);
    connectionState = 'error';
    connectionPromise = null;
    throw error;
  }
}

// Health check function
export async function checkDBHealth(): Promise<boolean> {
  try {
    if (connectionState !== 'connected' || mongoose.connection.readyState !== 1) {
      return false;
    }
    
    // Quick ping to verify connection
    await mongoose.connection.db.admin().ping();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return false;
  }
}

// Get connection status
export function getConnectionStatus(): {
  state: string;
  readyState: number;
  attempts: number;
  lastError: string | null;
} {
  return {
    state: connectionState,
    readyState: mongoose.connection.readyState,
    attempts: connectionAttempts,
    lastError: lastConnectionError?.message || null
  };
}

// Force reconnection (use sparingly)
export async function forceReconnect(): Promise<void> {
  console.log('Forcing database reconnection...');
  
  try {
    // Disconnect first
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    // Reset state
    connectionState = 'disconnected';
    connectionPromise = null;
    
    // Reconnect
    await connectDB();
  } catch (error) {
    console.error('Force reconnection failed:', error);
    throw error;
  }
} 