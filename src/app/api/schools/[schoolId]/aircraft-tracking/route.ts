import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';
import Plane from '@/models/Plane';
import mongoose from 'mongoose';

// GET /api/schools/[schoolId]/aircraft-tracking - Get real-time aircraft tracking for all school planes
export async function GET(
  request: NextRequest,
  { params }: { params: { schoolId: string } }
) {
  try {
    // Validate API key
    const apiKeyResult = await validateApiKey(request);
    if ('error' in apiKeyResult) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 });
    }

    // Authenticate user
    const authResult = await authenticateRequest(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Connect to databas
    await connectDB();

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json(
        { error: 'Invalid school ID format' },
        { status: 400 }
      );
    }

    // Get user role from token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    const decoded = verifyToken(token || '');
    const isSystemAdmin = decoded?.role === 'sys_admin';

    // If not a system admin, check if user has access to this school
    if (!isSystemAdmin) {
      // You can implement school access check here based on your existing logic
      // For now, we'll allow access if the user is authenticated
    }

    // Find all planes for this school
    const planes = await Plane.find({ school_id: params.schoolId }).lean();

    if (!planes || planes.length === 0) {
      return NextResponse.json({
        message: 'No planes found for this school',
        school_id: params.schoolId,
        aircraft: [],
        total: 0,
        timestamp: new Date().toISOString()
      });
    }

    // Fetch aircraft tracking data from ADSB.lol for each plane
    const aircraftTrackingPromises = planes.map(async (plane) => {
      try {
        const response = await fetch(`https://api.adsb.lol/v2/registration/${plane.registration}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.warn(`Failed to fetch tracking data for ${plane.registration}: ${response.status} ${response.statusText}`);
          return {
            plane_id: plane._id,
            registration: plane.registration,
            type: plane.type,
            aircraftModel: plane.aircraftModel,
            status: plane.status,
            tracking_data: null,
            error: `Failed to fetch tracking data: ${response.statusText}`,
            last_updated: new Date().toISOString()
          };
        }

        const trackingData = await response.json();

        return {
          plane_id: plane._id,
          registration: plane.registration,
          type: plane.type,
          aircraftModel: plane.aircraftModel,
          status: plane.status,
          tracking_data: trackingData,
          last_updated: new Date().toISOString()
        };

      } catch (error) {
        console.error(`Error fetching tracking data for ${plane.registration}:`, error);
        return {
          plane_id: plane._id,
          registration: plane.registration,
          type: plane.type,
          aircraftModel: plane.aircraftModel,
          status: plane.status,
          tracking_data: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          last_updated: new Date().toISOString()
        };
      }
    });

    // Wait for all tracking data requests to complete
    const aircraftTrackingData = await Promise.all(aircraftTrackingPromises);

    // Separate aircraft with active tracking vs. those without
    const activeAircraft = aircraftTrackingData.filter(aircraft => 
      aircraft.tracking_data && 
      aircraft.tracking_data.ac && 
      aircraft.tracking_data.ac.length > 0
    );

    const inactiveAircraft = aircraftTrackingData.filter(aircraft => 
      !aircraft.tracking_data || 
      !aircraft.tracking_data.ac || 
      aircraft.tracking_data.ac.length === 0
    );

    // Calculate summary statistics
    const summary = {
      total_planes: planes.length,
      planes_with_tracking: activeAircraft.length,
      planes_without_tracking: inactiveAircraft.length,
      planes_in_flight: activeAircraft.filter(aircraft => 
        aircraft.tracking_data?.ac?.[0]?.alt_baro && aircraft.tracking_data.ac[0].alt_baro > 0
      ).length
    };

    return NextResponse.json({
      message: 'Aircraft tracking data retrieved successfully',
      school_id: params.schoolId,
      summary,
      aircraft: aircraftTrackingData,
      active_aircraft: activeAircraft,
      inactive_aircraft: inactiveAircraft,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in GET /api/schools/[schoolId]/aircraft-tracking:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 