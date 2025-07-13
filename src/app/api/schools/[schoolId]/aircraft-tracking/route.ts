import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import Plane from '@/models/Plane';
import mongoose from 'mongoose';

// Security configuration for aircraft tracking endpoints - requires authentication and school access
const AIRCRAFT_TRACKING_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  allowedRoles: ['sys_admin', 'school_admin', 'instructor'],
  requireSchoolAccess: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'internal',
  rateLimiting: { maxRequests: 50, windowMs: 60000 }
};

// GET /api/schools/[schoolId]/aircraft-tracking - Get real-time aircraft tracking for all school planes
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { schoolId: string }, securityContext: any }
) => {
  try {
    // Establish database connection with retry logic
    await connectDB();

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Aircraft tracking data requested',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      userRole: securityContext.user?.role,
      schoolId: params.schoolId,
      timestamp: new Date().toISOString()
    }));

    // Validate school ID
    if (!mongoose.Types.ObjectId.isValid(params.schoolId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid school ID format',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Role-based access control - school_admin and instructor can only access their own school
    if (securityContext.user?.role === 'school_admin' || securityContext.user?.role === 'instructor') {
      // Convert both IDs to strings for comparison
      const userSchoolId = securityContext.user?.school_id?.toString();
      const requestedSchoolId = params.schoolId;
      
      if (userSchoolId !== requestedSchoolId) {
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'User attempted to access different school aircraft tracking',
          auditId: securityContext.auditId,
          userId: securityContext.user?._id,
          userRole: securityContext.user?.role,
          userSchoolId: userSchoolId,
          requestedSchoolId: requestedSchoolId,
          timestamp: new Date().toISOString()
        }));

        return NextResponse.json({
          success: false,
          error: 'Access denied: You can only view aircraft tracking for your own school',
          auditId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }, { status: 403 });
      }
    }

    // Find all planes for this school
    const planes = await (Plane as any).find({ school_id: params.schoolId }).lean();

    if (!planes || planes.length === 0) {
      console.log(JSON.stringify({
        level: 'INFO',
        message: 'No planes found for school',
        auditId: securityContext.auditId,
        userId: securityContext.user?._id,
        schoolId: params.schoolId,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: true,
        message: 'No planes found for this school',
        data: {
          school_id: params.schoolId,
          aircraft: [],
          summary: {
            total_planes: 0,
            planes_with_tracking: 0,
            planes_without_tracking: 0,
            planes_in_flight: 0
          }
        },
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Fetching aircraft tracking data',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      schoolId: params.schoolId,
      planesCount: planes.length,
      timestamp: new Date().toISOString()
    }));

    // Fetch aircraft tracking data from ADSB.lol for each plane
    const aircraftTrackingPromises = planes.map(async (plane) => {
      try {
        const response = await fetch(`https://api.adsb.lol/v2/registration/${plane.registration}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          // Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (!response.ok) {
          console.warn(JSON.stringify({
            level: 'WARN',
            message: 'Failed to fetch tracking data for aircraft',
            auditId: securityContext.auditId,
            registration: plane.registration,
            status: response.status,
            statusText: response.statusText,
            timestamp: new Date().toISOString()
          }));

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
        console.error(JSON.stringify({
          level: 'ERROR',
          message: 'Error fetching tracking data for aircraft',
          auditId: securityContext.auditId,
          registration: plane.registration,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }));

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

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Aircraft tracking data retrieved successfully',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      schoolId: params.schoolId,
      summary,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Aircraft tracking data retrieved successfully',
      data: {
        school_id: params.schoolId,
        summary,
        aircraft: aircraftTrackingData,
        active_aircraft: activeAircraft,
        inactive_aircraft: inactiveAircraft
      },
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error in aircraft tracking endpoint',
      auditId: securityContext.auditId,
      userId: securityContext.user?._id,
      schoolId: params.schoolId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, AIRCRAFT_TRACKING_CONFIG); 