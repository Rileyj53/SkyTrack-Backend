import mongoose, { Document, Schema } from 'mongoose';

// Interface for tracking data points
export interface ITrackingPoint {
  altitude: number;
  ground_speed: number;
  heading: number;
  latitude: number;
  longitude: number;
  timestamp: Date;
  // Additional useful fields
  vertical_speed?: number;
  fuel_remaining?: number;
  engine_rpm?: number;
  outside_air_temp?: number;
  wind_speed?: number;
  wind_direction?: number;
}

// Interface for the Track document
export interface ITrack extends Document {
  fa_flight_id?: string;
  tail_number: string;
  date?: Date;
  start_time?: string;
  end_time?: string;
  scheduled_off?: string;
  estimated_off?: string;
  actual_off?: string;
  scheduled_on?: string;
  estimated_on?: string;
  actual_on?: string;
  status?: string;
  origin?: {
    code: string;
    name: string;
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  destination?: {
    code: string;
    name: string;
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  tracking: ITrackingPoint[];
  
  // Additional useful fields
  flight_type?: string; // Training, Commercial, Personal, etc.
  flight_plan?: string; // IFR, VFR, etc.
  route?: string; // Planned route
  distance?: number; // Distance in nautical miles
  duration?: number; // Duration in minutes
  instructor_id?: mongoose.Types.ObjectId; // Reference to instructor if applicable
  student_id?: mongoose.Types.ObjectId; // Reference to student if applicable
  plane_id?: mongoose.Types.ObjectId; // Reference to plane
  school_id?: mongoose.Types.ObjectId; // Reference to flight school
  notes?: string; // Additional notes about the flight
  weather_conditions?: {
    visibility?: number;
    ceiling?: number;
    temperature?: number;
    wind_speed?: number;
    wind_direction?: number;
    precipitation?: string;
    dewpoint?: number;
    clouds?: string;
    remarks?: string;
  };
  flight_events?: Array<{
    timestamp: Date;
    event_type: string;
    description: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  }>;
  created_at: Date;
  updated_at: Date;
}

// Schema for tracking data points
const TrackingPointSchema = new Schema<ITrackingPoint>({
  altitude: { type: Number, required: true },
  ground_speed: { type: Number, required: true },
  heading: { type: Number, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, required: true },
  vertical_speed: { type: Number },
  fuel_remaining: { type: Number },
  engine_rpm: { type: Number },
  outside_air_temp: { type: Number },
  wind_speed: { type: Number },
  wind_direction: { type: Number }
}, { _id: false });

// Schema for airport
const AirportSchema = new Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: false },
  country: { type: String, required: false },
  latitude: { type: Number, required: false },
  longitude: { type: Number, required: false }
}, { _id: false });

// Schema for weather conditions
const WeatherConditionsSchema = new Schema({
  visibility: { type: Number },
  ceiling: { type: Number },
  temperature: { type: Number },
  wind_speed: { type: Number },
  wind_direction: { type: Number },
  precipitation: { type: String },
  dewpoint: { type: Number },
  clouds: { type: String },
  remarks: { type: String }
}, { _id: false });

// Schema for flight events
const FlightEventSchema = new Schema({
  timestamp: { type: Date, required: true },
  event_type: { type: String, required: true },
  description: { type: String, required: true },
  location: {
    latitude: { type: Number },
    longitude: { type: Number }
  }
}, { _id: false });

// Main Track schema
const TrackSchema = new Schema<ITrack>({
  fa_flight_id: { type: String, unique: true },
  tail_number: { type: String, required: true },
  date: { type: Date },
  start_time: { type: String },
  end_time: { type: String },
  scheduled_off: { type: String },
  estimated_off: { type: String },
  actual_off: { type: String },
  scheduled_on: { type: String },
  estimated_on: { type: String },
  actual_on: { type: String },
  status: { type: String },
  origin: { type: AirportSchema },
  destination: { type: AirportSchema },
  tracking: [TrackingPointSchema],
  
  // Additional fields
  flight_type: { type: String },
  flight_plan: { type: String },
  route: { type: String },
  distance: { type: Number },
  duration: { type: Number },
  instructor_id: { type: Schema.Types.ObjectId, ref: 'Instructor' },
  student_id: { type: Schema.Types.ObjectId, ref: 'Student' },
  plane_id: { type: Schema.Types.ObjectId, ref: 'Plane' },
  school_id: { type: Schema.Types.ObjectId, ref: 'School' },
  notes: { type: String },
  weather_conditions: WeatherConditionsSchema,
  flight_events: [FlightEventSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Create indexes for efficient querying
TrackSchema.index({ fa_flight_id: 1 }, { unique: true });
TrackSchema.index({ tail_number: 1 });
TrackSchema.index({ date: 1 });
TrackSchema.index({ school_id: 1 });
TrackSchema.index({ plane_id: 1 });
TrackSchema.index({ instructor_id: 1 });
TrackSchema.index({ student_id: 1 });
TrackSchema.index({ 'origin.code': 1, 'destination.code': 1 });

// Create and export the model
const Track = mongoose.models.Track || mongoose.model<ITrack>('Track', TrackSchema);

export default Track; 