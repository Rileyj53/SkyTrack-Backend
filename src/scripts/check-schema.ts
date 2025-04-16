import mongoose from 'mongoose';
import { User } from '../models/User';

async function checkSchema() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }
    
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
    
    // Get the User model's schema
    const userSchema = User.schema;
    console.log('User schema paths:', Object.keys(userSchema.paths));
    
    // Get the User model's collection
    const userCollection = mongoose.connection.collection('users');
    console.log('User collection name:', userCollection.collectionName);
    
    // Get a sample user document
    const sampleUser = await User.findOne();
    if (sampleUser) {
      console.log('Sample user document:', JSON.stringify(sampleUser.toObject(), null, 2));
    } else {
      console.log('No users found in the database');
    }
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('MongoDB disconnected successfully');
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

// Run the script
checkSchema(); 