import { MongoClient } from 'mongodb';

let client: MongoClient | null = null;

export async function connectEdgeDB() {
  if (client) {
    return client;
  }

  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    throw new Error('MongoDB URI is not defined in environment variables');
  }

  client = new MongoClient(mongoURI);
  await client.connect();
  return client;
}

export async function disconnectEdgeDB() {
  if (client) {
    await client.close();
    client = null;
  }
} 