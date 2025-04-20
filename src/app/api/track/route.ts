import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/middleware/auth';
import { verifyToken } from '@/lib/jwt';
import mongoose from 'mongoose';
import Track from '@/models/Track';
import FlightLog from '@/models/FlightLog';

// POST handler to start tracking a plane
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.plane_id || !body.school_id) {
      return NextResponse.json(
        { error: 'Missing required fields: plane_id and school_id are required' },
        { status: 400 }
      );
    }

    // Validate ObjectId fields
    if (!mongoose.Types.ObjectId.isValid(body.plane_id)) {
      return NextResponse.json(
        { error: 'Invalid plane_id format' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(body.school_id)) {
      return NextResponse.json(
        { error: 'Invalid school_id format' },
        { status: 400 }
      );
    }

    if (body.instructor_id && !mongoose.Types.ObjectId.isValid(body.instructor_id)) {
      return NextResponse.json(
        { error: 'Invalid instructor_id format' },
        { status: 400 }
      );
    }

    if (body.student_id && !mongoose.Types.ObjectId.isValid(body.student_id)) {
      return NextResponse.json(
        { error: 'Invalid student_id format' },
        { status: 400 }
      );
    }

    // Get the interval from query parameters or use default (30 seconds)
    const url = new URL(request.url);
    const interval = parseInt(url.searchParams.get('interval') || '30', 10);
    
    if (isNaN(interval) || interval < 10) {
      return NextResponse.json(
        { error: 'Invalid interval. Must be a number greater than or equal to 10 seconds.' },
        { status: 400 }
      );
    }

    // Get the AeroAPI key from environment variables
    const aeroApiKey = process.env.AEROAPI_KEY;
    if (!aeroApiKey) {
      return NextResponse.json(
        { error: 'AeroAPI key not configured' },
        { status: 500 }
      );
    }

    // Determine the tail number to use
    let tail_number = body.tail_number;
    
    // If tail_number is not provided, try to get it from the plane_id
    if (!tail_number) {
      // Import the Plane model
      const Plane = mongoose.model('Plane');
      
      // Find the plane by ID
      const plane = await Plane.findById(body.plane_id);
      
      if (!plane) {
        return NextResponse.json(
          { error: 'Plane not found' },
          { status: 404 }
        );
      }
      
      // Use the plane's tail number
      tail_number = plane.tail_number;
      
      if (!tail_number) {
        return NextResponse.json(
          { error: 'Plane does not have a tail number' },
          { status: 400 }
        );
      }
    }

    // Set start_time to current time if not provided
    const start_time = body.start_time || new Date().toISOString();

    // Fetch flight data from AeroAPI
    const flightResponse = await fetch(
      `https://aeroapi.flightaware.com/aeroapi/flights/${tail_number}`,
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
    
    // Log the flight data to see what status values are coming from the API
    console.log('Flight data from AeroAPI:', JSON.stringify(flightData, null, 2));
    
    // Check if there are any flights
    if (!flightData.flights || flightData.flights.length === 0) {
      return NextResponse.json(
        { error: 'No flight data found for the specified tail number' },
        { status: 404 }
      );
    }

    // Find the most recent flight that hasn't landed yet (no actual_on)
    let mostRecentFlight = null;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Set to start of current day
    
    // Sort flights by scheduled_off date (ascending) and filter out landed flights
    const activeFlights = flightData.flights
      .filter(flight => {
        // Filter out flights that have already landed
        if (flight.actual_on) return false;
        
        // Get the flight date from actual_off, estimated_off, or scheduled_off
        const flightDate = new Date(flight.actual_off || flight.estimated_off || flight.scheduled_off || 0);
        flightDate.setHours(0, 0, 0, 0); // Set to start of day for comparison
        
        // Only include flights from today
        return flightDate.getTime() === currentDate.getTime();
      })
      .sort((a, b) => {
        const dateA = new Date(a.scheduled_off || a.estimated_off || a.actual_off || 0);
        const dateB = new Date(b.scheduled_off || b.estimated_off || b.actual_off || 0);
        return dateA.getTime() - dateB.getTime();
      });
    
    // Find the flight with the soonest scheduled_off time that hasn't landed yet
    if (activeFlights.length > 0) {
      mostRecentFlight = activeFlights[0];
    }

    // If all flights have landed, create a track with the most recent flight data
    // but don't start tracking it yet
    if (!mostRecentFlight) {
      mostRecentFlight = flightData.flights[0];
      
      // Check if the flight is already being tracked
      const existingTrack = await (Track as any).findOne({
        fa_flight_id: mostRecentFlight.fa_flight_id
      }).exec();

      if (existingTrack) {
        return NextResponse.json({
          message: 'Flight is already being tracked',
          track: existingTrack,
          status: 'info'
        });
      }

      // Fetch detailed airport information for origin and destination
      let originDetails = null;
      let destinationDetails = null;

      if (mostRecentFlight.origin && mostRecentFlight.origin.code) {
        try {
          const originResponse = await fetch(
            `https://aeroapi.flightaware.com/aeroapi/airports/${mostRecentFlight.origin.code}`,
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

      if (mostRecentFlight.destination && mostRecentFlight.destination.code) {
        try {
          const destinationResponse = await fetch(
            `https://aeroapi.flightaware.com/aeroapi/airports/${mostRecentFlight.destination.code}`,
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

      // Create a new track with the flight data but no tracking data
      const track = new Track({
        fa_flight_id: null, // No active flight to track
        tail_number: tail_number,
        date: null, // No active flight date
        start_time: start_time,
        end_time: null, // Explicitly set to null until tracking ends
        scheduled_off: null,
        estimated_off: null,
        actual_off: null,
        scheduled_on: null,
        estimated_on: null,
        actual_on: null,
        status: "Preparing", // Custom status to indicate preparing for next flight
        origin: null, // No origin yet
        destination: null, // No destination yet
        tracking: [],
        flight_type: null,
        flight_plan: "",
        route: null,
        distance: null,
        duration: null,
        instructor_id: body.instructor_id ? new mongoose.Types.ObjectId(body.instructor_id) : undefined,
        student_id: body.student_id ? new mongoose.Types.ObjectId(body.student_id) : undefined,
        plane_id: new mongoose.Types.ObjectId(body.plane_id),
        school_id: new mongoose.Types.ObjectId(body.school_id),
        notes: `No active flights found. Preparing for next flight.`
      });

      // Save the track
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
        message: 'Flight has already landed. Created track record but not actively tracking.',
        track,
        status: 'info',
        instructions: `This flight has already landed. The system will check for new flights when you call the update endpoint.`
      }, { status: 201 });
    }
    
    // Check if the flight is already being tracked
    const existingTrack = await (Track as any).findOne({
      fa_flight_id: mostRecentFlight.fa_flight_id
    }).exec();

    if (existingTrack) {
      return NextResponse.json({
        message: 'Flight is already being tracked',
        track: existingTrack,
        status: 'info'
      });
    }

    // Fetch detailed airport information for origin and destination
    let originDetails = null;
    let destinationDetails = null;

    if (mostRecentFlight.origin && mostRecentFlight.origin.code) {
      try {
        const originResponse = await fetch(
          `https://aeroapi.flightaware.com/aeroapi/airports/${mostRecentFlight.origin.code}`,
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

    if (mostRecentFlight.destination && mostRecentFlight.destination.code) {
      try {
        const destinationResponse = await fetch(
          `https://aeroapi.flightaware.com/aeroapi/airports/${mostRecentFlight.destination.code}`,
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

    // Create a new track with the flight data
    const track = new Track({
      fa_flight_id: mostRecentFlight.fa_flight_id,
      tail_number: tail_number, // Use the determined tail number
      date: new Date(mostRecentFlight.actual_off || mostRecentFlight.estimated_off || mostRecentFlight.scheduled_off),
      start_time: start_time,
      end_time: null, // Explicitly set to null until tracking ends
      scheduled_off: mostRecentFlight.scheduled_off,
      estimated_off: mostRecentFlight.estimated_off,
      actual_off: mostRecentFlight.actual_off,
      scheduled_on: mostRecentFlight.scheduled_on,
      estimated_on: mostRecentFlight.estimated_on,
      actual_on: mostRecentFlight.actual_on,
      status: mostRecentFlight.status === 'En route' || mostRecentFlight.status === 'En Route' || mostRecentFlight.status === 'En Route / On Time' ? 'In Flight' : mostRecentFlight.status,
      origin: mostRecentFlight.origin ? {
        code: mostRecentFlight.origin.code,
        name: mostRecentFlight.origin.name,
        city: mostRecentFlight.origin.city,
        state: originDetails?.state || 'Unknown',
        country: originDetails?.country_code || 'Unknown',
        latitude: originDetails?.latitude || 0,
        longitude: originDetails?.longitude || 0
      } : undefined,
      destination: mostRecentFlight.destination ? {
        code: mostRecentFlight.destination.code,
        name: mostRecentFlight.destination.name,
        city: mostRecentFlight.destination.city,
        state: destinationDetails?.state || 'Unknown',
        country: destinationDetails?.country_code || 'Unknown',
        latitude: destinationDetails?.latitude || 0,
        longitude: destinationDetails?.longitude || 0
      } : undefined,
      tracking: [],
      flight_type: mostRecentFlight.type,
      flight_plan: '', // Not provided in the API response
      route: mostRecentFlight.route,
      distance: mostRecentFlight.route_distance,
      duration: null, // Will be calculated later
      instructor_id: body.instructor_id ? new mongoose.Types.ObjectId(body.instructor_id) : undefined,
      student_id: body.student_id ? new mongoose.Types.ObjectId(body.student_id) : undefined,
      plane_id: new mongoose.Types.ObjectId(body.plane_id),
      school_id: new mongoose.Types.ObjectId(body.school_id),
      notes: `Tracking started at ${new Date().toISOString()} with interval of ${interval} seconds`
    });

    // Save the track
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

    // Fetch initial tracking data
    const trackingResponse = await fetch(
      `https://aeroapi.flightaware.com/aeroapi/flights/${mostRecentFlight.fa_flight_id}/track`,
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

    // Set up automatic tracking using a background job
    // In a serverless environment like Next.js API routes, we need to use a different approach
    // since we can't keep a process running indefinitely
    
    // For this implementation, we'll use a client-side polling mechanism
    // The client should call the update endpoint at the specified interval
    
    // Return the track and provide instructions for setting up automatic updates
    return NextResponse.json({
      message: 'Tracking started successfully',
      track,
      status: 'success',
      instructions: `To automatically update tracking data every ${interval} seconds, you can:
      1. Use a client-side polling mechanism to call /api/track/${track._id}/update every ${interval} seconds
      2. Set up a webhook service to call /api/track/${track._id}/update at regular intervals
      3. Use a background job service like Vercel Cron Jobs to update the track at regular intervals`
    }, { status: 201 });
  } catch (error) {
    console.error('Error starting tracking:', error);
    return NextResponse.json(
      { error: 'Failed to start tracking' },
      { status: 500 }
    );
  }
}

// GET handler to retrieve tracking status
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const url = new URL(request.url);
    const tail_number = url.searchParams.get('tail_number');
    const plane_id = url.searchParams.get('plane_id');
    const school_id = url.searchParams.get('school_id');
    const instructor_id = url.searchParams.get('instructor_id');
    const student_id = url.searchParams.get('student_id');
    const status = url.searchParams.get('status');
    const start_date = url.searchParams.get('start_date');
    const end_date = url.searchParams.get('end_date');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const page = parseInt(url.searchParams.get('page') || '1');
    const sort_by = url.searchParams.get('sort_by') || 'createdAt';
    const sort_order = url.searchParams.get('sort_order') || 'desc';
    const search = url.searchParams.get('search');
    const update_tracking = url.searchParams.get('update_tracking') !== 'false'; // Default to true
    const active_only = url.searchParams.get('active_only') !== 'false'; // Default to true

    // Build filter object
    const filter: any = {};

    // Add filters if provided
    if (tail_number) filter.tail_number = tail_number;
    if (plane_id) filter.plane_id = plane_id;
    if (school_id) filter.school_id = school_id;
    if (instructor_id) filter.instructor_id = instructor_id;
    if (student_id) filter.student_id = student_id;
    
    // Only include tracks with status "Preparing" or "In Flight" if active_only is true
    if (active_only) {
      filter.status = { $in: ['Preparing', 'In Flight'] };
    }
    
    // If a specific status is requested, override the default filter
    if (status) {
      filter.status = status;
    }

    // Add date range filter if provided
    if (start_date || end_date) {
      filter.date = {};
      if (start_date) filter.date.$gte = start_date;
      if (end_date) filter.date.$lte = end_date;
    }

    // Add text search if provided
    if (search) {
      filter.$or = [
        { tail_number: { $regex: search, $options: 'i' } },
        { 'origin.code': { $regex: search, $options: 'i' } },
        { 'origin.name': { $regex: search, $options: 'i' } },
        { 'destination.code': { $regex: search, $options: 'i' } },
        { 'destination.name': { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    // Validate ObjectId fields
    if (plane_id && !mongoose.Types.ObjectId.isValid(plane_id)) {
      return NextResponse.json(
        { error: 'Invalid plane_id format' },
        { status: 400 }
      );
    }

    if (school_id && !mongoose.Types.ObjectId.isValid(school_id)) {
      return NextResponse.json(
        { error: 'Invalid school_id format' },
        { status: 400 }
      );
    }

    if (instructor_id && !mongoose.Types.ObjectId.isValid(instructor_id)) {
      return NextResponse.json(
        { error: 'Invalid instructor_id format' },
        { status: 400 }
      );
    }

    if (student_id && !mongoose.Types.ObjectId.isValid(student_id)) {
      return NextResponse.json(
        { error: 'Invalid student_id format' },
        { status: 400 }
      );
    }

    // Validate sort parameters
    const validSortFields = ['createdAt', 'updatedAt', 'date', 'start_time', 'tail_number', 'status'];
    if (!validSortFields.includes(sort_by)) {
      return NextResponse.json(
        { error: `Invalid sort_by field. Valid fields are: ${validSortFields.join(', ')}` },
        { status: 400 }
      );
    }

    if (sort_order !== 'asc' && sort_order !== 'desc') {
      return NextResponse.json(
        { error: 'Invalid sort_order. Must be "asc" or "desc"' },
        { status: 400 }
      );
    }

    // Find active tracks with pagination
    const skip = (page - 1) * limit;
    const sortOptions: any = {};
    sortOptions[sort_by] = sort_order === 'asc' ? 1 : -1;

    // Get the AeroAPI key from environment variables
    const aeroApiKey = process.env.AEROAPI_KEY;
    if (!aeroApiKey) {
      return NextResponse.json(
        { error: 'AeroAPI key not configured' },
        { status: 500 }
      );
    }

    // Find all active tracks first
    const activeTracks = await (Track as any).find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    // Update tracking data for each active track if update_tracking is true
    if (update_tracking) {
      for (const track of activeTracks) {
        try {
          // Skip tracks without a fa_flight_id
          if (!track.fa_flight_id) continue;

          // Fetch updated flight data from AeroAPI
          const flightResponse = await fetch(
            `https://aeroapi.flightaware.com/aeroapi/flights/${track.fa_flight_id}`,
            {
              headers: {
                'x-apikey': aeroApiKey
              }
            }
          );

          if (flightResponse.ok) {
            const flightData = await flightResponse.json();
            
            // Check if there are any flights
            if (flightData.flights && flightData.flights.length > 0) {
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
                  }
                } catch (error) {
                  console.error('Error updating FlightLog status:', error);
                  // Continue with the next track even if FlightLog update fails
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error updating track ${track._id}:`, error);
          // Continue with the next track even if this one fails
        }
      }
    }

    // Get the updated tracks after all updates
    const updatedTracks = await (Track as any).find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    // Count total documents for pagination
    const total = await Track.countDocuments(filter);

    // Add documentation about the school_id filter in the response
    const response = {
      tracks: updatedTracks,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        school_id: school_id || 'Not specified',
        active_only: active_only,
        status: status || (active_only ? 'Preparing, In Flight' : 'All')
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error retrieving tracks:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve tracks' },
      { status: 500 }
    );
  }
} 