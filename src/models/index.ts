import mongoose from 'mongoose';
import { School } from './School';
import { User } from './User';
import Student from './Student';
import Instructor from './Instructor';
import Plane from './Plane';
import ScheduleModel from './ScheduleModel';
import Program from './Program';

// Export all models
export {
  School,
  User,
  Student,
  Instructor,
  Plane,
  ScheduleModel,
  Program
};

// Export a function to initialize all models
export function initializeModels() {
  // This function can be used to initialize all models
  return { User };
} 