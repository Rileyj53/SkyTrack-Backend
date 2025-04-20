import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import Track from '@/models/Track';
import FlightLog from '@/models/FlightLog';

// GET handler to update tracking data for a specific track
export async function GET(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  try {
    await connectDB();

    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if (apiKeyResult instanceof NextResponse) {
      return apiKeyResult;
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Validate trackId format
    if (!mongoose.Types.ObjectId.isValid(params.trackId)) {
      return NextResponse.json(
        { error: 'Invalid track ID format' },
        { status: 400 }
      );
    }

    // Find the track
    const track = await (Track as any).findById(params.trackId);
    if (!track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    // Check if the track is already completed or cancelled
    if (track.status === 'Completed' || track.status === 'Cancelled') {
      return NextResponse.json({
        message: `Track is already ${track.status.toLowerCase()}`,
        track
      });
    }

    // Get the AeroAPI key from environment variables
    const aeroApiKey = process.env.AEROAPI_KEY;
    if (!aeroApiKey) {
      return NextResponse.json(
        { error: 'AeroAPI key not configured' },
        { status: 500 }
      );
    }

    // If the track has no fa_flight_id, try to find a new flight
    if (!track.fa_flight_id) {
      const flightDataResponse = await fetch(
        `https://aeroapi.flightaware.com/aeroapi/flights/${track.tail_number}`,
        {
          headers: {
            "x-apikey": process.env.AEROAPI_KEY || "",
          },
        }
      );

      if (!flightDataResponse.ok) {
        return NextResponse.json(
          { error: "Failed to fetch flight data from AeroAPI" },
          { status: 500 }
        );
      }

      const flightData = await flightDataResponse.json();

      if (!flightData.flights || flightData.flights.length === 0) {
        return NextResponse.json(
          { error: "No flights found for this tail number" },
          { status: 404 }
        );
      }

      // Sort flights by scheduled_off date (ascending) and filter out landed flights
      const currentDate = new Date();
      const activeFlights = flightData.flights
        .filter(flight => !flight.actual_on)
        .sort((a, b) => {
          const dateA = new Date(a.scheduled_off || a.estimated_off || a.actual_off || 0);
          const dateB = new Date(b.scheduled_off || b.estimated_off || b.actual_off || 0);
          return dateA.getTime() - dateB.getTime();
        });
      
      // Find the flight with the soonest scheduled_off date that hasn't landed yet
      let newFlight = null;
      for (const flight of activeFlights) {
        const scheduledOffDate = new Date(flight.scheduled_off || flight.estimated_off || flight.actual_off || 0);
        
        // If the flight is scheduled for today or in the past, it's a candidate
        if (scheduledOffDate <= currentDate) {
          newFlight = flight;
          break;
        }
      }
      
      // If no flights are scheduled for today or in the past, take the next scheduled flight
      if (!newFlight && activeFlights.length > 0) {
        newFlight = activeFlights[0];
      }

      if (newFlight) {
        // Update the track with the new flight information
        track.fa_flight_id = newFlight.fa_flight_id;
        track.status = "Active";
        track.notes = "Found new flight to track";
        await track.save();
      } else {
        return NextResponse.json(
          { error: "No active flights found for this tail number" },
          { status: 404 }
        );
      }
    }

    // Check if the track has a valid Flight Aware ID
    if (!track.fa_flight_id) {
      // Fetch new flight data from AeroAPI for the tail number
      const flightResponse = await fetch(
        `https://aeroapi.flightaware.com/aeroapi/flights/${track.tail_number}`,
        {
          headers: {
            'x-apikey': aeroApiKey
          }
        }
      );

      if (!flightResponse.ok) {
        return NextResponse.json(
          { error: `Failed to fetch flight data: ${flightResponse.statusText}` },
          { status: flightResponse.status }
        );
      }

      const flightData = await flightResponse.json();
      
      // Check if there are any flights
      if (!flightData.flights || flightData.flights.length === 0) {
        return NextResponse.json({
          message: 'No flights found for this aircraft',
          track
        });
      }

      // Find the most recent flight that hasn't landed yet (no actual_on)
      let newFlight = null;
      for (const flight of flightData.flights) {
        if (!flight.actual_on) {
          newFlight = flight;
          break;
        }
      }

      // If all flights have landed, return the current track
      if (!newFlight) {
        return NextResponse.json({
          message: 'No active flights found for this aircraft',
          track
        });
      }

      // Check if the new flight is already being tracked by another track
      const existingTrack = await (Track as any).findOne({
        fa_flight_id: newFlight.fa_flight_id,
        _id: { $ne: track._id } // Exclude the current track
      }).exec();

      if (existingTrack) {
        return NextResponse.json({
          message: 'New flight is already being tracked by another track',
          existingTrack
        });
      }

      // Fetch detailed airport information for the new flight
      let originDetails = null;
      let destinationDetails = null;

      if (newFlight.origin && newFlight.origin.code) {
        try {
          const originResponse = await fetch(
            `https://aeroapi.flightaware.com/aeroapi/airports/${newFlight.origin.code}`,
            {
              headers: {
                'x-apikey': aeroApiKey
              }
            }
          );

          if (originResponse.ok) {
            originDetails = await originResponse.json();
          }
        } catch (error) {
          console.error('Error fetching origin airport details:', error);
          // Continue without origin details
        }
      }

      if (newFlight.destination && newFlight.destination.code) {
        try {
          const destinationResponse = await fetch(
            `https://aeroapi.flightaware.com/aeroapi/airports/${newFlight.destination.code}`,
            {
              headers: {
                'x-apikey': aeroApiKey
              }
            }
          );

          if (destinationResponse.ok) {
            destinationDetails = await destinationResponse.json();
          }
        } catch (error) {
          console.error('Error fetching destination airport details:', error);
          // Continue without destination details
        }
      }

      // Update the track with the new flight data
      track.fa_flight_id = newFlight.fa_flight_id;
      track.date = new Date(newFlight.actual_off || newFlight.estimated_off || newFlight.scheduled_off);
      track.scheduled_off = newFlight.scheduled_off;
      track.estimated_off = newFlight.estimated_off;
      track.actual_off = newFlight.actual_off;
      track.scheduled_on = newFlight.scheduled_on;
      track.estimated_on = newFlight.estimated_on;
      track.actual_on = newFlight.actual_on;
      track.status = newFlight.status === 'En route' ? 'In Flight' : newFlight.status;
      track.origin = newFlight.origin ? {
        code: newFlight.origin.code,
        name: newFlight.origin.name,
        city: newFlight.origin.city,
        state: originDetails?.state || 'Unknown',
        country: originDetails?.country_code || 'Unknown',
        latitude: originDetails?.latitude || 0,
        longitude: originDetails?.longitude || 0
      } : undefined;
      track.destination = newFlight.destination ? {
        code: newFlight.destination.code,
        name: newFlight.destination.name,
        city: newFlight.destination.city,
        state: destinationDetails?.state || 'Unknown',
        country: destinationDetails?.country_code || 'Unknown',
        latitude: destinationDetails?.latitude || 0,
        longitude: destinationDetails?.longitude || 0
      } : undefined;
      track.tracking = [];
      track.flight_type = newFlight.type;
      track.route = newFlight.route;
      track.distance = newFlight.route_distance;
      track.duration = null; // Will be calculated later
      track.notes = track.notes ? 
        `${track.notes}\nFound new flight: ${newFlight.fa_flight_id}` : 
        `Found new flight: ${newFlight.fa_flight_id}`;

      // Save the updated track
      await track.save();

      // Fetch initial tracking data for the new flight
      const trackingResponse = await fetch(
        `https://aeroapi.flightaware.com/aeroapi/flights/${newFlight.fa_flight_id}/track`,
        {
          headers: {
            'x-apikey': aeroApiKey
          }
        }
      );

      if (trackingResponse.ok) {
        const trackingData = await trackingResponse.json();
        
        // Process tracking data
        if (trackingData.positions && trackingData.positions.length > 0) {
          const trackingPoints = trackingData.positions.map(position => ({
            altitude: position.altitude,
            ground_speed: position.groundspeed,
            heading: position.heading,
            latitude: position.latitude,
            longitude: position.longitude,
            timestamp: new Date(position.timestamp),
            vertical_speed: 0, // Not provided in the API response
            fuel_remaining: null, // Not provided in the API response
            engine_rpm: null, // Not provided in the API response
            outside_air_temp: null, // Not provided in the API response
            wind_speed: null, // Not provided in the API response
            wind_direction: null // Not provided in the API response
          }));

          // Update the track with the tracking data
          track.tracking = trackingPoints;
          await track.save();
        }
      }

      return NextResponse.json({
        message: 'Found new flight and updated track',
        track
      });
    }

    // Check if the current flight has already landed
    if (track.actual_on) {
      // Fetch new flight data from AeroAPI for the tail number
      const flightResponse = await fetch(
        `https://aeroapi.flightaware.com/aeroapi/flights/${track.tail_number}`,
        {
          headers: {
            'x-apikey': aeroApiKey
          }
        }
      );

      if (!flightResponse.ok) {
        return NextResponse.json(
          { error: `Failed to fetch flight data: ${flightResponse.statusText}` },
          { status: flightResponse.status }
        );
      }

      const flightData = await flightResponse.json();
      
      // Check if there are any flights
      if (!flightData.flights || flightData.flights.length === 0) {
        return NextResponse.json({
          message: 'No new flights found for this aircraft',
          track
        });
      }

      // Find the most recent flight that hasn't landed yet (no actual_on)
      let newFlight = null;
      for (const flight of flightData.flights) {
        if (!flight.actual_on) {
          newFlight = flight;
          break;
        }
      }

      // If all flights have landed, return the current track
      if (!newFlight) {
        return NextResponse.json({
          message: 'No active flights found for this aircraft',
          track
        });
      }

      // Check if the new flight is already being tracked by another track
      const existingTrack = await (Track as any).findOne({
        fa_flight_id: newFlight.fa_flight_id,
        _id: { $ne: track._id } // Exclude the current track
      }).exec();

      if (existingTrack) {
        return NextResponse.json({
          message: 'New flight is already being tracked by another track',
          existingTrack
        });
      }

      // Fetch detailed airport information for the new flight
      let originDetails = null;
      let destinationDetails = null;

      if (newFlight.origin && newFlight.origin.code) {
        try {
          const originResponse = await fetch(
            `https://aeroapi.flightaware.com/aeroapi/airports/${newFlight.origin.code}`,
            {
              headers: {
                'x-apikey': aeroApiKey
              }
            }
          );

          if (originResponse.ok) {
            originDetails = await originResponse.json();
          }
        } catch (error) {
          console.error('Error fetching origin airport details:', error);
          // Continue without origin details
        }
      }

      if (newFlight.destination && newFlight.destination.code) {
        try {
          const destinationResponse = await fetch(
            `https://aeroapi.flightaware.com/aeroapi/airports/${newFlight.destination.code}`,
            {
              headers: {
                'x-apikey': aeroApiKey
              }
            }
          );

          if (destinationResponse.ok) {
            destinationDetails = await destinationResponse.json();
          }
        } catch (error) {
          console.error('Error fetching destination airport details:', error);
          // Continue without destination details
        }
      }

      // Update the track with the new flight data
      track.fa_flight_id = newFlight.fa_flight_id;
      track.date = new Date(newFlight.actual_off || newFlight.estimated_off || newFlight.scheduled_off);
      track.scheduled_off = newFlight.scheduled_off;
      track.estimated_off = newFlight.estimated_off;
      track.actual_off = newFlight.actual_off;
      track.scheduled_on = newFlight.scheduled_on;
      track.estimated_on = newFlight.estimated_on;
      track.actual_on = newFlight.actual_on;
      track.status = newFlight.status === 'En route' ? 'In Flight' : newFlight.status;
      track.origin = newFlight.origin ? {
        code: newFlight.origin.code,
        name: newFlight.origin.name,
        city: newFlight.origin.city,
        state: originDetails?.state || 'Unknown',
        country: originDetails?.country_code || 'Unknown',
        latitude: originDetails?.latitude || 0,
        longitude: originDetails?.longitude || 0
      } : undefined;
      track.destination = newFlight.destination ? {
        code: newFlight.destination.code,
        name: newFlight.destination.name,
        city: newFlight.destination.city,
        state: destinationDetails?.state || 'Unknown',
        country: destinationDetails?.country_code || 'Unknown',
        latitude: destinationDetails?.latitude || 0,
        longitude: destinationDetails?.longitude || 0
      } : undefined;
      track.tracking = [];
      track.flight_type = newFlight.type;
      track.route = newFlight.route;
      track.distance = newFlight.route_distance;
      track.duration = null; // Will be calculated later
      track.notes = track.notes ? 
        `${track.notes}\nFound new flight: ${newFlight.fa_flight_id}` : 
        `Found new flight: ${newFlight.fa_flight_id}`;

      // Save the updated track
      await track.save();

      // Fetch initial tracking data for the new flight
      const trackingResponse = await fetch(
        `https://aeroapi.flightaware.com/aeroapi/flights/${newFlight.fa_flight_id}/track`,
        {
          headers: {
            'x-apikey': aeroApiKey
          }
        }
      );

      if (trackingResponse.ok) {
        const trackingData = await trackingResponse.json();
        
        // Process tracking data
        if (trackingData.positions && trackingData.positions.length > 0) {
          const trackingPoints = trackingData.positions.map(position => ({
            altitude: position.altitude,
            ground_speed: position.groundspeed,
            heading: position.heading,
            latitude: position.latitude,
            longitude: position.longitude,
            timestamp: new Date(position.timestamp),
            vertical_speed: 0, // Not provided in the API response
            fuel_remaining: null, // Not provided in the API response
            engine_rpm: null, // Not provided in the API response
            outside_air_temp: null, // Not provided in the API response
            wind_speed: null, // Not provided in the API response
            wind_direction: null // Not provided in the API response
          }));

          // Update the track with the tracking data
          track.tracking = trackingPoints;
          await track.save();
        }
      }

      return NextResponse.json({
        message: 'Found new flight and updated track',
        track
      });
    }

    // Fetch updated flight data from AeroAPI
    const flightResponse = await fetch(
      `https://aeroapi.flightaware.com/aeroapi/flights/${track.fa_flight_id}`,
      {
        headers: {
          'x-apikey': aeroApiKey
        }
      }
    );

    if (!flightResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch flight data: ${flightResponse.statusText}` },
        { status: flightResponse.status }
      );
    }

    const flightData = await flightResponse.json();
    
    // Check if there are any flights
    if (!flightData.flights || flightData.flights.length === 0) {
      return NextResponse.json(
        { error: 'No flight data found for the specified Flight Aware ID' },
        { status: 404 }
      );
    }

    // Get the flight data
    const flight = flightData.flights[0];
    
    // Update the track with the latest flight data
    track.status = flight.status === 'En route' || flight.status === 'En Route' || flight.status === 'En Route / On Time' ? 'In Flight' : flight.status;
    track.actual_off = flight.actual_off || track.actual_off;
    track.estimated_off = flight.estimated_off || track.estimated_off;
    track.scheduled_off = flight.scheduled_off || track.scheduled_off;
    track.actual_on = flight.actual_on || track.actual_on;
    track.estimated_on = flight.estimated_on || track.estimated_on;
    track.scheduled_on = flight.scheduled_on || track.scheduled_on;
    
    // If the flight is completed, update the status
    if (flight.actual_on) {
      track.status = 'Completed';
      track.end_time = new Date().toISOString();
    } else {
      // Ensure end_time is null for flights that haven't completed
      track.end_time = null;
    }
    
    // Fetch updated tracking data
    const trackingResponse = await fetch(
      `https://aeroapi.flightaware.com/aeroapi/flights/${track.fa_flight_id}/track`,
      {
        headers: {
          'x-apikey': aeroApiKey
        }
      }
    );

    if (trackingResponse.ok) {
      const trackingData = await trackingResponse.json();
      
      // Process tracking data
      if (trackingData.positions && trackingData.positions.length > 0) {
        // Get the latest timestamp in the existing tracking data
        const latestExistingTimestamp = track.tracking.length > 0 
          ? new Date(Math.max(...track.tracking.map(point => new Date(point.timestamp).getTime())))
          : new Date(0);
        
        // Filter out positions that are already in the tracking data
        const newPositions = trackingData.positions.filter(position => 
          new Date(position.timestamp) > latestExistingTimestamp
        );
        
        if (newPositions.length > 0) {
          // Convert new positions to tracking points
          const newTrackingPoints = newPositions.map(position => ({
            altitude: position.altitude,
            ground_speed: position.groundspeed,
            heading: position.heading,
            latitude: position.latitude,
            longitude: position.longitude,
            timestamp: new Date(position.timestamp),
            vertical_speed: 0, // Not provided in the API response
            fuel_remaining: null, // Not provided in the API response
            engine_rpm: null, // Not provided in the API response
            outside_air_temp: null, // Not provided in the API response
            wind_speed: null, // Not provided in the API response
            wind_direction: null // Not provided in the API response
          }));
          
          // Add new tracking points to the track
          track.tracking = [...track.tracking, ...newTrackingPoints];
          
          // Update the distance if available
          if (trackingData.actual_distance) {
            track.distance = trackingData.actual_distance;
          }
          
          // Calculate duration if we have both takeoff and landing times
          if (track.actual_off && track.actual_on) {
            const takeoffTime = new Date(track.actual_off);
            const landingTime = new Date(track.actual_on);
            const durationMs = landingTime.getTime() - takeoffTime.getTime();
            track.duration = Math.round(durationMs / (1000 * 60)); // Convert to minutes
          }
        }
      }
    }

    // Check if the track has been inactive for too long (5 minutes)
    const lastUpdateTime = track.updatedAt || track.createdAt;
    const currentTime = new Date();
    
    // Check if lastUpdateTime is defined before trying to access getTime()
    if (lastUpdateTime) {
      const inactiveTimeMs = currentTime.getTime() - lastUpdateTime.getTime();
      const inactiveTimeMinutes = inactiveTimeMs / (1000 * 60);
      
      // If the track has been inactive for more than 5 minutes and is not already completed
      if (inactiveTimeMinutes > 5 && track.status !== 'Completed') {
        // Check if there are any tracking points
        if (track.tracking.length > 0) {
          // Get the latest tracking point
          const latestTrackingPoint = track.tracking[track.tracking.length - 1];
          const latestTrackingTime = new Date(latestTrackingPoint.timestamp);
          const trackingInactiveTimeMs = currentTime.getTime() - latestTrackingTime.getTime();
          const trackingInactiveTimeMinutes = trackingInactiveTimeMs / (1000 * 60);
          
          // If the latest tracking point is more than 5 minutes old, mark the track as completed
          if (trackingInactiveTimeMinutes > 5) {
            track.status = 'Completed';
            track.notes = track.notes ? 
              `${track.notes}\nTrack automatically marked as completed due to inactivity (${trackingInactiveTimeMinutes.toFixed(1)} minutes)` : 
              `Track automatically marked as completed due to inactivity (${trackingInactiveTimeMinutes.toFixed(1)} minutes)`;
          }
        } else {
          // If there are no tracking points and the track has been inactive for more than 5 minutes
          track.status = 'Completed';
          track.notes = track.notes ? 
            `${track.notes}\nTrack automatically marked as completed due to inactivity (${inactiveTimeMinutes.toFixed(1)} minutes)` : 
            `Track automatically marked as completed due to inactivity (${inactiveTimeMinutes.toFixed(1)} minutes)`;
        }
      }
    }
    
    // Save the updated track
    await track.save();

    // Update the FlightLog status if we have student_id and instructor_id
    if (track.student_id && track.instructor_id) {
      try {
        // Find a matching FlightLog based on the criteria
        const matchingFlightLog = await (FlightLog as any).findOne({
          student_id: track.student_id,
          instructor_id: track.instructor_id,
          plane_reg: track.tail_number,
          school_id: track.school_id,
          // Find a flight log with a start_time close to the track's start_time
          start_time: track.start_time?.split('T')[1]?.substring(0, 5) || ''
        });

        if (matchingFlightLog) {
          // Map the track status to FlightLog status
          let flightLogStatus = 'Scheduled';
          if (track.status === 'In Flight' || track.status === 'En route' || track.status === 'En Route' || track.status === 'En Route / On Time') {
            flightLogStatus = 'In-Flight';
          } else if (track.status === 'Completed' || track.status === 'Landed') {
            flightLogStatus = 'Completed';
          } else if (track.status === 'Cancelled' || track.status === 'Canceled') {
            flightLogStatus = 'Canceled';
          }

          // Update the FlightLog status
          await (FlightLog as any).findByIdAndUpdate(matchingFlightLog._id, {
            status: flightLogStatus
          });

          console.log(`Updated FlightLog status to ${flightLogStatus} for flight log ID: ${matchingFlightLog._id}`);
        } else {
          console.log(`No matching FlightLog found for track ID: ${track._id}`);
          console.log('Search criteria:', {
            student_id: track.student_id,
            instructor_id: track.instructor_id,
            plane_reg: track.tail_number,
            school_id: track.school_id,
            start_time: track.start_time?.split('T')[1]?.substring(0, 5) || ''
          });
        }
      } catch (error) {
        console.error('Error updating FlightLog status:', error);
        // Continue with the response even if FlightLog update fails
      }
    }

    return NextResponse.json({
      message: 'Track updated successfully',
      track
    });
  } catch (error) {
    console.error('Error updating track:', error);
    return NextResponse.json(
      { error: 'Failed to update track' },
      { status: 500 }
    );
  }
} 