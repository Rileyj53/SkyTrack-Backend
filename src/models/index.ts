import mongoose from 'mongoose';
import { School } from './School';
import { User } from './User';
import Pilot from './Pilot';
import Plane from './Plane';
import Schedule from './Schedule';

// Export all models
export {
  School,
  User,
  Pilot,
  Plane,
  Schedule
};

// Export a function to initialize all models
export function initializeModels() {
  // This function can be used to initialize all models
  return { User };
} 