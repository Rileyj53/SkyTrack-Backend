import { MongoClient, MongoClientOptions } from 'mongodb';

let client: MongoClient | null = null;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

// Connection options optimized for edge runtime
const connectionOptions: MongoClientOptions = {
  maxPoolSize: 5, // Smaller pool for edge runtime
  serverSelectionTimeoutMS: 5000, // 5 seconds timeout
  socketTimeoutMS: 30000, // 30 seconds socket timeout
  connectTimeoutMS: 10000, // 10 seconds connection timeout
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  retryWrites: true, // Retry failed writes
  retryReads: true, // Retry failed reads
  compressors: ['zlib'], // Enable compression for better performance
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

export async function connectEdgeDB(): Promise<MongoClient> {
  // Return existing client if it's still connected
  if (client && client.topology && !client.topology.isDestroyed()) {
    try {
      // Ping to verify connection is still alive
      await client.db('admin').command({ ping: 1 });
      return client;
    } catch (error) {
      console.warn('⚠️ Existing edge DB connection failed ping test, reconnecting...');
      client = null;
    }
  }

  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    throw new Error('MongoDB URI is not defined in environment variables');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(`Edge DB connection attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}`);
      
      // Close existing client if it exists
      if (client) {
        try {
          await client.close();
        } catch (closeError) {
          console.warn('Warning closing previous client:', closeError.message);
        }
        client = null;
      }
      
      // Create new client with retry options
      client = new MongoClient(mongoURI, connectionOptions);
      
      // Connect with timeout
      await client.connect();
      
      // Verify connection is working
      await client.db('admin').command({ ping: 1 });
      
      connectionAttempts = 0;
      console.log('✅ Edge DB connected successfully');
      
      return client;
      
    } catch (error) {
      lastError = error as Error;
      connectionAttempts++;
      
      console.error(`❌ Edge DB connection attempt ${attempt + 1} failed:`, {
        error: error.message,
        attempt: attempt + 1,
        maxAttempts: MAX_RETRY_ATTEMPTS
      });
      
      // Clean up failed client
      if (client) {
        try {
          await client.close();
        } catch (closeError) {
          // Ignore close errors
        }
        client = null;
      }
      
      // Don't retry on the last attempt
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        const delay = calculateRetryDelay(attempt);
        console.log(`⏳ Retrying edge DB connection in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  // If we get here, all retry attempts failed
  const finalError = new Error(
    `Failed to connect to edge database after ${MAX_RETRY_ATTEMPTS} attempts. Last error: ${lastError?.message}`
  );
  
  console.error('💥 Edge DB connection failed permanently:', {
    attempts: MAX_RETRY_ATTEMPTS,
    lastError: lastError?.message,
    mongoURI: mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') // Hide credentials in logs
  });
  
  throw finalError;
}

export async function disconnectEdgeDB(): Promise<void> {
  if (client) {
    try {
      await client.close();
      console.log('✅ Edge DB disconnected successfully');
    } catch (error) {
      console.error('❌ Edge DB disconnection error:', error.message);
      throw error;
    } finally {
      client = null;
    }
  }
}

// Health check function for edge DB
export async function checkEdgeDBHealth(): Promise<boolean> {
  try {
    if (!client || !client.topology || client.topology.isDestroyed()) {
      return false;
    }
    
    // Ping the database to ensure it's responsive
    await client.db('admin').command({ ping: 1 });
    return true;
  } catch (error) {
    console.error('Edge DB health check failed:', error.message);
    return false;
  }
}

// Reconnection function for edge DB
export async function reconnectEdgeDB(): Promise<MongoClient> {
  console.log('🔄 Attempting edge DB reconnection...');
  client = null;
  return await connectEdgeDB();
} 