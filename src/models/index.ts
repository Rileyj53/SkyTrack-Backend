import mongoose from 'mongoose';
import { User } from './User';

// Ensure that the User model is properly registered with Mongoose
export { User };

// Export a function to initialize all models
export function initializeModels() {
  // This function can be used to initialize all models
  return { User };
} 