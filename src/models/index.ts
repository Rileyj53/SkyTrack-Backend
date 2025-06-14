import mongoose from 'mongoose';
import { School } from './School';
import { User } from './User';
import Student from './Student';
import Instructor from './Instructor';
import Plane from './Plane';
import Program from './Program';
import FlightSchedule from './FlightSchedule';

// Export all models
export {
  School,
  User,
  Student,
  Instructor,
  Plane,
  Program,
  FlightSchedule
};

// Export a function to initialize all models
export function initializeModels() {
  // This function can be used to initialize all models
  return { User };
} 