import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import { School } from '@/models/School';
import Plane from '@/models/Plane';
import FlightSchedule from '@/models/FlightSchedule';
import FlightInvoice from '@/models/FlightInvoice';
import PlaneRecord from '@/models/PlaneRecord';

// Security configuration for plane stats endpoints
const PLANE_STATS_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: false, // GET operations don't need CSRF
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin', 'instructor', 'student', 'member', 'mechanic'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 50,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET /api/organizations/[organizationId]/planes/stats - Get comprehensive plane statistics
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing plane stats request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate organization ID
  if (!mongoose.Types.ObjectId.isValid(params.organization)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID format provided',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID format',
        code: 'INVALID_ORGANIZATION_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  const organizationId = new mongoose.Types.ObjectId(params.organization);

  try {
    // Parse query parameters for date ranges and filters
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || '30'; // Default to 30 days
    const includeFinancials = searchParams.get('include_financials') === 'true';
    const includeMaintenance = searchParams.get('include_maintenance') === 'true';
    const planeStatus = searchParams.get('status'); // Filter by plane status
    
    // Calculate date ranges
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - parseInt(timeRange));
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Verify organization exists (still using School model for now)
    const organization = await School.findById(organizationId);
    if (!organization) {
      return NextResponse.json({
        error: {
          message: 'Organization not found',
          code: 'ORGANIZATION_NOT_FOUND',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    // **1. PLANE OVERVIEW STATISTICS**
    const planeQuery: any = { organization_id: organizationId };
    if (planeStatus) planeQuery.status = planeStatus;

    const [totalPlanes, activePlanes, planesByStatus, planesByType] = await Promise.all([
      Plane.countDocuments(planeQuery),
      Plane.countDocuments({ ...planeQuery, status: { $in: ['active', 'Available'] } }),
      Plane.aggregate([
        { $match: planeQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalHours: { $sum: '$total_hours' },
            avgUtilization: { $avg: '$utilization.utilizationRate' }
          }
        }
      ]),
      Plane.aggregate([
        { $match: planeQuery },
        {
          $group: {
            _id: '$aircraftModel',
            count: { $sum: 1 },
            totalHours: { $sum: '$total_hours' },
            avgUtilization: { $avg: '$utilization.utilizationRate' }
          }
        },
        { $sort: { count: -1 } }
      ])
    ]);

    // **2. MAINTENANCE ALERTS & SCHEDULE** (if requested)
    let maintenanceStats = null;
    let maintenanceAlerts = null;
    let upcomingMaintenance = null;
    let overdueMaintenance = null;

    if (includeMaintenance) {
      // Get all planes for this organization
      const allPlanes = await (Plane as any).find({ organization_id: organizationId }).select('_id registration').lean();
      
      // Get maintenance records
      const maintenanceRecords = await (PlaneRecord as any).find({
        plane_id: { $in: allPlanes.map(p => p._id) },
        record_type: 'maintenance',
        nextDue: { $exists: true, $ne: null }
      }).populate('plane_id', 'registration').lean();

      // Calculate maintenance alerts
      maintenanceAlerts = maintenanceRecords
        .filter(record => record.nextDue && record.plane_id?.registration)
        .map(record => {
          const daysUntilMaintenance = Math.ceil((new Date(record.nextDue).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return {
            registration: record.plane_id.registration,
            record_id: record._id,
            title: record.title,
            description: record.description,
            status: record.status,
            next_maintenance: record.nextDue,
            days_until_maintenance: daysUntilMaintenance,
            aircraft_hours: record.aircraftHours,
            is_overdue: daysUntilMaintenance < 0,
            severity: daysUntilMaintenance < 0 ? 'critical' : daysUntilMaintenance <= 7 ? 'high' : daysUntilMaintenance <= 30 ? 'medium' : 'low'
          };
        })
        .sort((a, b) => a.days_until_maintenance - b.days_until_maintenance);

      upcomingMaintenance = maintenanceAlerts.filter(alert => !alert.is_overdue && alert.days_until_maintenance <= 30);
      overdueMaintenance = maintenanceAlerts.filter(alert => alert.is_overdue);

      // Maintenance statistics
      maintenanceStats = await (PlaneRecord as any).aggregate([
        { 
          $match: { 
            plane_id: { $in: allPlanes.map(p => p._id) },
            record_type: 'maintenance',
            date: { $gte: startDate }
          } 
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgAircraftHours: { $avg: '$aircraftHours' },
            totalPartsReplaced: { $sum: { $size: { $ifNull: ['$partsReplaced', []] } } }
          }
        }
      ]);
    }

    // **3. FLIGHT OPERATIONS BY PLANE**
    const flightOperations = await FlightSchedule.aggregate([
      { 
        $match: { 
          organization_id: organizationId, 
          created_at: { $gte: startDate } 
        } 
      },
      {
        $group: {
          _id: '$plane_id',
          totalFlights: { $sum: 1 },
          completedFlights: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          totalScheduledHours: { $sum: '$scheduled_duration' },
          totalActualHours: { $sum: '$actual_duration' },
          avgFlightDuration: { $avg: '$actual_duration' },
          revenue: { $sum: '$total_amount' }
        }
      },
      {
        $lookup: {
          from: 'planes',
          localField: '_id',
          foreignField: '_id',
          as: 'plane'
        }
      },
      {
        $unwind: '$plane'
      },
      {
        $project: {
          plane_id: '$_id',
          registration: '$plane.registration',
          aircraftModel: '$plane.aircraftModel',
          totalFlights: 1,
          completedFlights: 1,
          completionRate: { $multiply: [{ $divide: ['$completedFlights', '$totalFlights'] }, 100] },
          totalScheduledHours: 1,
          totalActualHours: 1,
          avgFlightDuration: 1,
          revenue: 1,
          utilizationRate: { $divide: ['$totalActualHours', parseInt(timeRange) * 8 * 60 * 60 * 1000] } // Convert to milliseconds (8 hours per day)
        }
      },
      { $sort: { totalFlights: -1 } }
    ]);

    // **4. FINANCIAL METRICS BY PLANE** (if requested)
    let financialStats = null;
    let revenueByPlane = null;
    let costAnalysis = null;

    if (includeFinancials) {
      [financialStats, revenueByPlane] = await Promise.all([
        FlightInvoice.aggregate([
          { $match: { organization_id: organizationId, created_at: { $gte: startDate } } },
          {
            $group: {
              _id: '$plane_id',
              totalRevenue: { $sum: '$total_amount' },
              invoiceCount: { $sum: 1 },
              avgInvoiceValue: { $avg: '$total_amount' },
              pendingAmount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$total_amount', 0] } },
              approvedAmount: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$total_amount', 0] } }
            }
          },
          {
            $lookup: {
              from: 'planes',
              localField: '_id',
              foreignField: '_id',
              as: 'plane'
            }
          },
          {
            $unwind: '$plane'
          },
          {
            $project: {
              plane_id: '$_id',
              registration: '$plane.registration',
              totalRevenue: 1,
              invoiceCount: 1,
              avgInvoiceValue: 1,
              pendingAmount: 1,
              approvedAmount: 1
            }
          },
          { $sort: { totalRevenue: -1 } }
        ]),
        FlightInvoice.aggregate([
          { $match: { organization_id: organizationId, created_at: { $gte: monthStart } } },
          {
            $group: {
              _id: { 
                plane_id: '$plane_id',
                date: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }
              },
              dailyRevenue: { $sum: '$total_amount' },
              invoiceCount: { $sum: 1 }
            }
          },
          { $sort: { '_id.date': 1 } }
        ])
      ]);

      // Cost analysis (estimated based on flight hours and maintenance)
      costAnalysis = await Plane.aggregate([
        { $match: { organization_id: organizationId } },
        {
          $lookup: {
            from: 'planerecords',
            localField: '_id',
            foreignField: 'plane_id',
            pipeline: [
              { $match: { record_type: 'maintenance', date: { $gte: startDate } } }
            ],
            as: 'maintenanceRecords'
          }
        },
        {
          $project: {
            registration: 1,
            total_hours: 1,
            estimatedFuelCost: { $multiply: ['$total_hours', 50] }, // $50/hour fuel estimate
            estimatedMaintenanceCost: { $multiply: [{ $size: '$maintenanceRecords' }, 500] }, // $500 per maintenance record
            maintenanceRecordsCount: { $size: '$maintenanceRecords' }
          }
        }
      ]);
    }

    // **5. UTILIZATION METRICS**
    const utilizationMetrics = await Plane.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $lookup: {
          from: 'flightschedules',
          localField: '_id',
          foreignField: 'plane_id',
          pipeline: [
            { $match: { created_at: { $gte: startDate }, status: 'completed' } }
          ],
          as: 'recentFlights'
        }
      },
      {
        $project: {
          registration: 1,
          aircraftModel: 1,
          status: 1,
          total_hours: 1,
          'utilization.utilizationRate': 1,
          'utilization.hoursPerMonth': 1,
          recentFlightsCount: { $size: '$recentFlights' },
          recentFlightHours: { $sum: '$recentFlights.actual_duration' },
          avgFlightDuration: { $avg: '$recentFlights.actual_duration' },
          utilizationRate: {
            $divide: [
              { $sum: '$recentFlights.actual_duration' },
              parseInt(timeRange) * 8 * 60 * 60 * 1000 // 8 hours per day in milliseconds
            ]
          }
        }
      },
      { $sort: { utilizationRate: -1 } }
    ]);

    // **6. SCHEDULE ADHERENCE BY PLANE**
    const scheduleAdherence = await FlightSchedule.aggregate([
      { 
        $match: { 
          organization_id: organizationId,
          status: 'completed',
          actual_start_time: { $ne: null },
          created_at: { $gte: startDate }
        } 
      },
      {
        $project: {
          plane_id: 1,
          onTimeStart: {
            $lte: [
              { $abs: { $subtract: ['$actual_start_time', '$scheduled_start_time'] } },
              15 * 60 * 1000 // 15 minutes in milliseconds
            ]
          },
          delayMinutes: {
            $divide: [
              { $subtract: ['$actual_start_time', '$scheduled_start_time'] },
              60000 // Convert to minutes
            ]
          }
        }
      },
      {
        $group: {
          _id: '$plane_id',
          total: { $sum: 1 },
          onTime: { $sum: { $cond: ['$onTimeStart', 1, 0] } },
          avgDelayMinutes: { $avg: '$delayMinutes' }
        }
      },
      {
        $lookup: {
          from: 'planes',
          localField: '_id',
          foreignField: '_id',
          as: 'plane'
        }
      },
      {
        $unwind: '$plane'
      },
      {
        $project: {
          plane_id: '$_id',
          registration: '$plane.registration',
          total: 1,
          onTime: 1,
          onTimeRate: { $multiply: [{ $divide: ['$onTime', '$total'] }, 100] },
          avgDelayMinutes: 1
        }
      },
      { $sort: { onTimeRate: -1 } }
    ]);

    // **7. PEAK USAGE TIMES BY PLANE**
    const peakUsageTimes = await FlightSchedule.aggregate([
      { $match: { organization_id: organizationId, created_at: { $gte: startDate } } },
      {
        $project: {
          plane_id: 1,
          hour: { $hour: '$scheduled_start_time' },
          dayOfWeek: { $dayOfWeek: '$scheduled_start_time' }
        }
      },
      {
        $group: {
          _id: { plane_id: '$plane_id', hour: '$hour' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.plane_id',
          peakHours: {
            $push: {
              hour: '$_id.hour',
              count: '$count'
            }
          },
          totalFlights: { $sum: '$count' }
        }
      },
      {
        $lookup: {
          from: 'planes',
          localField: '_id',
          foreignField: '_id',
          as: 'plane'
        }
      },
      {
        $unwind: '$plane'
      },
      {
        $project: {
          plane_id: '$_id',
          registration: '$plane.registration',
          peakHours: { $slice: [{ $sortArray: { input: '$peakHours', sortBy: { count: -1 } } }, 5] },
          totalFlights: 1
        }
      }
    ]);

    // **8. AIRCRAFT AGE & VALUE ANALYSIS**
    const aircraftAgeAnalysis = await Plane.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $project: {
          registration: 1,
          aircraftModel: 1,
          year: 1,
          total_hours: 1,
          status: 1,
          age: { $subtract: [new Date().getFullYear(), '$year'] },
          ageCategory: {
            $switch: {
              branches: [
                { case: { $lt: [{ $subtract: [new Date().getFullYear(), '$year'] }, 5] }, then: 'new' },
                { case: { $lt: [{ $subtract: [new Date().getFullYear(), '$year'] }, 15] }, then: 'mid-age' },
                { case: { $lt: [{ $subtract: [new Date().getFullYear(), '$year'] }, 25] }, then: 'older' }
              ],
              default: 'vintage'
            }
          }
        }
      },
      {
        $group: {
          _id: '$ageCategory',
          count: { $sum: 1 },
          avgAge: { $avg: '$age' },
          avgHours: { $avg: '$total_hours' },
          planes: {
            $push: {
              registration: '$registration',
              aircraftModel: '$aircraftModel',
              year: '$year',
              total_hours: '$total_hours',
              status: '$status'
            }
          }
        }
      },
      { $sort: { avgAge: 1 } }
    ]);

    // **9. OPERATIONAL EFFICIENCY METRICS**
    const operationalEfficiency = await Plane.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $lookup: {
          from: 'flightschedules',
          localField: '_id',
          foreignField: 'plane_id',
          pipeline: [
            { $match: { created_at: { $gte: startDate } } }
          ],
          as: 'recentFlights'
        }
      },
      {
        $project: {
          registration: 1,
          aircraftModel: 1,
          status: 1,
          total_hours: 1,
          recentFlightsCount: { $size: '$recentFlights' },
          completedFlights: { $size: { $filter: { input: '$recentFlights', cond: { $eq: ['$$this.status', 'completed'] } } } },
          totalScheduledHours: { $sum: '$recentFlights.scheduled_duration' },
          totalActualHours: { $sum: '$recentFlights.actual_duration' },
          efficiency: {
            $cond: [
              { $gt: ['$recentFlights', []] },
              { $divide: [{ $sum: '$recentFlights.actual_duration' }, { $sum: '$recentFlights.scheduled_duration' }] },
              0
            ]
          }
        }
      },
      { $sort: { efficiency: -1 } }
    ]);

    // Calculate summary metrics
    const totalFlightHours = flightOperations.reduce((sum, op) => sum + (op.totalActualHours || 0), 0);
    const totalRevenue = includeFinancials ? revenueByPlane?.reduce((sum, rev) => sum + (rev.totalRevenue || 0), 0) : 0;
    const avgUtilizationRate = utilizationMetrics.reduce((sum, util) => sum + (util.utilizationRate || 0), 0) / utilizationMetrics.length || 0;
    const avgOnTimeRate = scheduleAdherence.reduce((sum, adh) => sum + (adh.onTimeRate || 0), 0) / scheduleAdherence.length || 0;

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Plane stats retrieved successfully',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      organizationName: organization.name,
      timeRange,
      includeFinancials,
      includeMaintenance,
      totalPlanes,
      activePlanes,
      totalFlightHours,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    // Format the comprehensive response
    const stats = {
      overview: {
        total_planes: totalPlanes,
        active_planes: activePlanes,
        inactive_planes: totalPlanes - activePlanes,
        total_flight_hours: totalFlightHours,
        average_utilization_rate: Math.round(avgUtilizationRate * 100) / 100,
        average_on_time_rate: Math.round(avgOnTimeRate * 100) / 100
      },
      
      plane_status_breakdown: planesByStatus,
      plane_type_breakdown: planesByType,
      
      flight_operations: {
        operations_by_plane: flightOperations,
        total_flights: flightOperations.reduce((sum, op) => sum + (op.totalFlights || 0), 0),
        completed_flights: flightOperations.reduce((sum, op) => sum + (op.completedFlights || 0), 0),
        average_completion_rate: flightOperations.length > 0 
          ? Math.round((flightOperations.reduce((sum, op) => sum + (op.completedFlights || 0), 0) / flightOperations.reduce((sum, op) => sum + (op.totalFlights || 0), 0)) * 100)
          : 0
      },
      
      utilization_metrics: {
        utilization_by_plane: utilizationMetrics,
        top_utilized_planes: utilizationMetrics.slice(0, 5),
        least_utilized_planes: utilizationMetrics.slice(-5).reverse()
      },
      
      schedule_adherence: {
        adherence_by_plane: scheduleAdherence,
        average_on_time_rate: avgOnTimeRate,
        top_performing_planes: scheduleAdherence.slice(0, 5),
        planes_needing_attention: scheduleAdherence.filter(adh => (adh.onTimeRate || 0) < 80).slice(0, 5)
      },
      
      peak_usage_times: {
        usage_by_plane: peakUsageTimes
      },
      
      aircraft_age_analysis: {
        age_categories: aircraftAgeAnalysis,
        fleet_age_distribution: aircraftAgeAnalysis.reduce((acc, cat) => {
          acc[cat._id] = cat.count;
          return acc;
        }, {} as any)
      },
      
      operational_efficiency: {
        efficiency_by_plane: operationalEfficiency,
        top_efficient_planes: operationalEfficiency.slice(0, 5),
        efficiency_insights: {
          average_efficiency: operationalEfficiency.reduce((sum, eff) => sum + (eff.efficiency || 0), 0) / operationalEfficiency.length || 0,
          high_efficiency_count: operationalEfficiency.filter(eff => (eff.efficiency || 0) > 0.9).length,
          low_efficiency_count: operationalEfficiency.filter(eff => (eff.efficiency || 0) < 0.7).length
        }
      },
      
      ...(includeMaintenance && {
        maintenance: {
          alerts: maintenanceAlerts,
          upcoming_maintenance: upcomingMaintenance,
          overdue_maintenance: overdueMaintenance,
          maintenance_stats: maintenanceStats,
          critical_alerts: maintenanceAlerts?.filter(alert => alert.severity === 'critical') || [],
          high_priority_alerts: maintenanceAlerts?.filter(alert => alert.severity === 'high') || []
        }
      }),
      
      ...(includeFinancials && {
        financial_metrics: {
          revenue_by_plane: revenueByPlane,
          total_revenue: totalRevenue,
          average_revenue_per_plane: revenueByPlane?.length > 0 ? totalRevenue / revenueByPlane.length : 0,
          cost_analysis: costAnalysis,
          top_revenue_generators: revenueByPlane?.slice(0, 5) || [],
          revenue_trends: revenueByPlane
        }
      })
    };

    return NextResponse.json({
      success: true,
      message: 'Plane statistics retrieved successfully',
      data: {
        stats,
        metadata: {
          organization_id: params.organization,
          organization_name: organization.name,
          time_range_days: parseInt(timeRange),
          start_date: startDate.toISOString(),
          end_date: now.toISOString(),
          includes_financials: includeFinancials,
          includes_maintenance: includeMaintenance,
          generated_at: now.toISOString(),
          processing_time_ms: processingTime
        }
      },
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error retrieving plane stats',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, PLANE_STATS_SECURITY_CONFIG); 

// POST /api/organizations/[organizationId]/planes/stats - Get detailed statistics for individual planes
export const POST = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing detailed planes stats request',
    auditId: securityContext.auditId,
    organizationId: params.organization,
    userId: securityContext.user?.id,
    userRole: securityContext.user?.role,
    timestamp: new Date().toISOString()
  }));

  // Validate organization ID
  if (!mongoose.Types.ObjectId.isValid(params.organization)) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Invalid organization ID format provided',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Invalid organization ID format',
        code: 'INVALID_ORGANIZATION_ID',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  const organizationId = new mongoose.Types.ObjectId(params.organization);

  try {
    // Get request body for specific plane IDs filter (optional)
    const requestData = await request.json().catch(() => ({}));
    const planeIds = requestData.planeIds || [];
    const timeRange = requestData.timeRange || 90; // Default to 90 days for detailed analysis
    const includeInactive = requestData.includeInactive || false;
    
    // Calculate date ranges
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - timeRange);

    // Build plane query
    const planeQuery: any = { organization_id: organizationId };
    
    // Add plane ID filter if specified
    if (planeIds.length > 0) {
      // Validate all plane IDs
      const validIds = planeIds.filter(id => mongoose.Types.ObjectId.isValid(id))
                               .map(id => new mongoose.Types.ObjectId(id));
      
      if (validIds.length === 0) {
        return NextResponse.json({
          error: {
            message: 'No valid plane IDs provided',
            code: 'INVALID_PLANE_IDS',
            requestId: securityContext.auditId,
            timestamp: new Date().toISOString()
          }
        }, { status: 400 });
      }
      
      planeQuery._id = { $in: validIds };
    }
    
    // Filter out inactive planes if specified
    if (!includeInactive) {
      planeQuery.status = { $nin: ['inactive', 'decommissioned', 'sold'] };
    }

    // 1. Get all planes with this query
    const activePlanes = await (Plane as any).find(planeQuery).lean();
    
    if (activePlanes.length === 0) {
      return NextResponse.json({
        error: {
          message: 'No planes found matching criteria',
          code: 'NO_PLANES_FOUND',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }
    
    // Get all plane IDs for subsequent queries
    const allPlaneIds = activePlanes.map(plane => plane._id);

    // 2. Get detailed metrics for each plane
    const planeDetails = await Promise.all(allPlaneIds.map(async (planeId) => {
      // Get base plane data
      const plane = activePlanes.find(p => p._id.toString() === planeId.toString());
      
      // Calculate plane age
      const planeAge = plane.year ? (new Date().getFullYear() - plane.year) : null;
      
      // A. Get recent flight schedules
      const recentFlights = await (FlightSchedule as any).find({
        plane_id: planeId,
        created_at: { $gte: startDate }
      }).sort({ created_at: -1 }).lean();
      
      // B. Get maintenance records
      const maintenanceRecords = await (PlaneRecord as any).find({
        plane_id: planeId,
        record_type: 'maintenance'
      }).sort({ date: -1 }).lean();
      
      const upcomingMaintenance = maintenanceRecords
        .filter(record => record.nextDue && new Date(record.nextDue) > now)
        .sort((a, b) => new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime())[0];
      
      const lastCompletedMaintenance = maintenanceRecords
        .filter(record => record.date && record.status === 'completed')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      // Calculate days until next maintenance
      const daysUntilMaintenance = upcomingMaintenance 
        ? Math.ceil((new Date(upcomingMaintenance.nextDue).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) 
        : null;
      
      // C. Get financial data
      const financialData = await FlightInvoice.aggregate([
        { 
          $match: { 
            plane_id: planeId,
            created_at: { $gte: startDate }
          } 
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total_amount' },
            invoiceCount: { $sum: 1 },
            paidRevenue: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total_amount', 0] } },
            pendingRevenue: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$total_amount', 0] } }
          }
        }
      ]);
      
      // D. Calculate operational metrics
      const completedFlights = recentFlights.filter(flight => flight.status === 'completed');
      const totalScheduledHours = recentFlights.reduce((sum, flight) => sum + (flight.scheduled_duration || 0), 0);
      const totalActualHours = completedFlights.reduce((sum, flight) => sum + (flight.actual_duration || 0), 0);
      
      // Calculate on-time performance
      const onTimeFlights = completedFlights.filter(flight => 
        flight.actual_start_time && 
        flight.scheduled_start_time && 
        Math.abs(new Date(flight.actual_start_time).getTime() - new Date(flight.scheduled_start_time).getTime()) <= 15 * 60 * 1000
      );
      const onTimeRate = completedFlights.length > 0 
        ? (onTimeFlights.length / completedFlights.length) 
        : null;
      
      // Calculate utilization metrics
      const hoursPerDay = totalActualHours / (timeRange * (1000 * 60 * 60 * 24));
      const utilizationRate = hoursPerDay / 8; // Assuming 8 flight hours per day is 100% utilization
      
      // Calculate revenue per flight hour
      const revenuePerHour = totalActualHours > 0 && financialData.length > 0
        ? financialData[0].totalRevenue / (totalActualHours / (1000 * 60 * 60))
        : null;
      
      // E. Get weekly activity pattern
      const weekdayActivity = [0, 0, 0, 0, 0, 0, 0]; // Sun, Mon, Tue, Wed, Thu, Fri, Sat
      recentFlights.forEach(flight => {
        if (flight.scheduled_start_time) {
          const day = new Date(flight.scheduled_start_time).getDay();
          weekdayActivity[day]++;
        }
      });
      
      // F. Get hourly activity pattern
      const hourlyActivity = Array(24).fill(0);
      recentFlights.forEach(flight => {
        if (flight.scheduled_start_time) {
          const hour = new Date(flight.scheduled_start_time).getHours();
          hourlyActivity[hour]++;
        }
      });
      
      // G. Compute availability metrics
      const maintenanceDays = maintenanceRecords
        .filter(record => 
          record.date && 
          new Date(record.date) >= startDate && 
          record.status === 'completed'
        )
        .reduce((total, record) => {
          // Estimate 1 day per maintenance event if no specific duration
          return total + 1;
        }, 0);
      
      const availabilityRate = (timeRange - maintenanceDays) / timeRange;
      
      // H. Calculate profitability metrics (estimated)
      const hourlyRate = plane.hourlyRates?.wet || 0;
      const estimatedRevenue = hourlyRate * (totalActualHours / (1000 * 60 * 60));
      const estimatedCosts = (totalActualHours / (1000 * 60 * 60)) * (hourlyRate * 0.6); // Assume costs are 60% of rate
      const estimatedProfit = estimatedRevenue - estimatedCosts;
      const profitMargin = estimatedRevenue > 0 ? (estimatedProfit / estimatedRevenue) * 100 : 0;
      
      // Compile the detailed metrics
      return {
        planeId: plane._id,
        registration: plane.registration,
        aircraftModel: plane.aircraftModel,
        type: plane.type,
        year: plane.year,
        age: planeAge,
        status: plane.status,
        location: plane.location,
        
        // Key metrics
        totalHours: plane.total_hours,
        engineHours: plane.engineHours,
        tachTime: plane.tach_time,
        hoppsTime: plane.hopps_time,
        
        // Maintenance metrics
        lastMaintenanceDate: plane.last_maintenance,
        nextMaintenanceDate: plane.next_maintenance,
        daysUntilMaintenance,
        maintenanceStatus: daysUntilMaintenance < 0 ? 'overdue' : 
                          daysUntilMaintenance <= 7 ? 'due-soon' : 'ok',
        
        // Recent activity
        recentActivity: {
          totalFlights: recentFlights.length,
          completedFlights: completedFlights.length,
          cancelledFlights: recentFlights.filter(flight => flight.status === 'cancelled').length,
          scheduledHours: totalScheduledHours / (1000 * 60 * 60), // Convert ms to hours
          actualHours: totalActualHours / (1000 * 60 * 60),
          utilizationRate: utilizationRate * 100, // As percentage
          availabilityRate: availabilityRate * 100, // As percentage
          onTimeRate: onTimeRate !== null ? onTimeRate * 100 : null, // As percentage
          mostRecentFlight: recentFlights.length > 0 ? {
            date: recentFlights[0].actual_start_time || recentFlights[0].scheduled_start_time,
            duration: recentFlights[0].actual_duration / (1000 * 60 * 60), // Convert ms to hours
            status: recentFlights[0].status
          } : null
        },
        
        // Scheduling patterns
        schedulingPatterns: {
          weekdayDistribution: [
            { day: 'Sunday', count: weekdayActivity[0] },
            { day: 'Monday', count: weekdayActivity[1] },
            { day: 'Tuesday', count: weekdayActivity[2] },
            { day: 'Wednesday', count: weekdayActivity[3] },
            { day: 'Thursday', count: weekdayActivity[4] },
            { day: 'Friday', count: weekdayActivity[5] },
            { day: 'Saturday', count: weekdayActivity[6] }
          ],
          hourlyDistribution: hourlyActivity.map((count, hour) => ({
            hour,
            count
          })),
          peakHour: hourlyActivity.indexOf(Math.max(...hourlyActivity)),
          peakDay: weekdayActivity.indexOf(Math.max(...weekdayActivity))
        },
        
        // Financial metrics
        financialMetrics: financialData.length > 0 ? {
          totalRevenue: financialData[0].totalRevenue,
          paidRevenue: financialData[0].paidRevenue,
          pendingRevenue: financialData[0].pendingRevenue,
          invoiceCount: financialData[0].invoiceCount,
          revenuePerFlightHour: revenuePerHour,
          estimatedProfit: estimatedProfit,
          estimatedProfitMargin: profitMargin
        } : null,
        
        // Maintenance records summary
        maintenanceHistory: {
          totalRecords: maintenanceRecords.length,
          recentMaintenanceEvents: maintenanceRecords
            .filter(record => record.date && new Date(record.date) >= startDate)
            .length,
          lastCompletedMaintenance: lastCompletedMaintenance ? {
            date: lastCompletedMaintenance.date,
            title: lastCompletedMaintenance.title,
            description: lastCompletedMaintenance.description,
            aircraftHours: lastCompletedMaintenance.aircraftHours
          } : null,
          upcomingMaintenance: upcomingMaintenance ? {
            dueDate: upcomingMaintenance.nextDue,
            title: upcomingMaintenance.title,
            description: upcomingMaintenance.description
          } : null
        },
        
        // Hourly rates
        rates: plane.hourlyRates || {},
        
        // Notes and additional info
        notes: plane.notes
      };
    }));

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Detailed plane stats retrieved successfully',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      planeCount: planeDetails.length,
      timeRange,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Detailed plane statistics retrieved successfully',
      data: {
        planes: planeDetails,
        metadata: {
          organization_id: params.organization,
          time_range_days: timeRange,
          plane_count: planeDetails.length,
          start_date: startDate.toISOString(),
          end_date: now.toISOString(),
          generated_at: now.toISOString(),
          processing_time_ms: processingTime
        }
      },
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Error retrieving detailed plane stats',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, {
  ...PLANE_STATS_SECURITY_CONFIG,
  requireCSRF: true // Since this is a POST request
}); 