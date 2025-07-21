import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import { School } from '@/models/School';
import Student from '@/models/Student';
import Instructor from '@/models/Instructor';
import Plane from '@/models/Plane';
import FlightSchedule from '@/models/FlightSchedule';
import FlightInvoice from '@/models/FlightInvoice';
import PlaneRecord from '@/models/PlaneRecord';

// Security configuration for stats endpoints
const STATS_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: false, // GET operations don't need CSRF
  allowedRoles: ['sys_admin', 'school_admin', 'instructor'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 50,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET /api/organizations/[organizationId]/stats - Get comprehensive organization statistics
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing organization stats request',
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
    // Parse query parameters for date ranges
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || '30'; // Default to 30 days
    const includeFinancials = searchParams.get('include_financials') === 'true';
    
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

    // **1. UPCOMING LESSONS** (still using organization_id in database for now)
    const upcomingLessons = await FlightSchedule.countDocuments({
      organization_id: organizationId,
      status: { $in: ['scheduled', 'confirmed'] },
      scheduled_start_time: { $gte: now }
    });

    // Get detailed upcoming lessons for next 7 days (still using organization_id in database for now)
    const upcomingLessonsDetailed = await (FlightSchedule as any).find({
      organization_id: organizationId,
      status: { $in: ['scheduled', 'confirmed'] },
      scheduled_start_time: { 
        $gte: now,
        $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      }
    })
    .populate('student_id', 'contact_email')
    .populate('instructor_id', 'contact_email')
    .populate('plane_id', 'registration')
    .sort({ scheduled_start_time: 1 })
    .limit(10)
    .lean();

    // **2. ACTIVE PLANES** - Fix status matching (still using organization_id in database for now)
    const [activePlanes, totalPlanes, planesByStatus] = await Promise.all([
      Plane.countDocuments({
        organization_id: organizationId,
        status: { $in: ['active', 'Available'] } // Support both status values
      }),
      Plane.countDocuments({
        organization_id: organizationId
      }),
      Plane.aggregate([
        { $match: { organization_id: organizationId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // **3. PLANE EFFICIENCY & UTILIZATION** (still using organization_id in database for now)
    const planeStats = await Plane.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalHours: { $sum: '$total_hours' },
          avgUtilization: { $avg: '$utilization.utilizationRate' },
          avgHoursPerMonth: { $avg: '$utilization.hoursPerMonth' }
        }
      }
    ]);

    // **4. INSTRUCTOR EFFICIENCY** (still using organization_id in database for now)
    const instructorStats = await Instructor.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalTeachingHours: { $sum: '$teachingHours' },
          totalFlightHours: { $sum: '$flightHours' },
          avgUtilization: { $avg: '$utilization' },
          totalStudents: { $sum: '$students' }
        }
      }
    ]);

    // **5. FLIGHT OPERATIONS** (still using organization_id in database for now)
    const flightStats = await FlightSchedule.aggregate([
      { $match: { organization_id: organizationId, created_at: { $gte: startDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalScheduledDuration: { $sum: '$scheduled_duration' },
          totalActualDuration: { $sum: '$actual_duration' },
          avgScheduledDuration: { $avg: '$scheduled_duration' },
          avgActualDuration: { $avg: '$actual_duration' }
        }
      }
    ]);

    // **6. STUDENT METRICS** (still using organization_id in database for now)
    const studentStats = await Student.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // **7. RECENT ACTIVITY** (still using organization_id in database for now)
    const recentFlights = await FlightSchedule.countDocuments({
      organization_id: organizationId,
      status: 'completed',
      actual_end_time: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    // **8. FINANCIAL METRICS** (if requested) (still using organization_id in database for now)
    let financialStats = null;
    let monthlyRevenue = null;
    if (includeFinancials) {
      [financialStats, monthlyRevenue] = await Promise.all([
        FlightInvoice.aggregate([
          { $match: { organization_id: organizationId, created_at: { $gte: startDate } } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalAmount: { $sum: '$total_amount' },
              avgAmount: { $avg: '$total_amount' }
            }
          }
        ]),
        FlightInvoice.aggregate([
          { $match: { organization_id: organizationId, created_at: { $gte: monthStart } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
              dailyRevenue: { $sum: '$total_amount' },
              invoiceCount: { $sum: 1 }
            }
          },
          { $sort: { '_id': 1 } }
        ])
      ]);
    }

    // **9. MAINTENANCE ALERTS** - Updated to use PlaneRecord system (still using organization_id in database for now)
    const currentDate = new Date();
    
    // Get all planes for this organization (still using organization_id in database for now)
    const allPlanes = await (Plane as any).find({ organization_id: organizationId }).select('_id registration').lean();
    
    const maintenanceRecords = await (PlaneRecord as any).find({
      plane_id: { $in: allPlanes.map(p => p._id) },
      record_type: 'maintenance',
      nextDue: { $exists: true, $ne: null }
    }).populate('plane_id', 'registration').lean();

    const maintenanceAlerts = maintenanceRecords
      .filter(record => record.nextDue && record.plane_id?.registration)
      .map(record => {
        const daysUntilMaintenance = Math.ceil((new Date(record.nextDue).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          registration: record.plane_id.registration,
          record_id: record._id,
          record_type: record.record_type,
          title: record.title,
          description: record.description,
          status: record.status,
          next_maintenance: record.nextDue,
          days_until_maintenance: daysUntilMaintenance,
          aircraft_hours: record.aircraftHours,
          is_overdue: daysUntilMaintenance < 0
        };
      })
      .sort((a, b) => a.days_until_maintenance - b.days_until_maintenance);

    // Recent maintenance activity
    const recentMaintenanceActivity = await (PlaneRecord as any).find({
      plane_id: { $in: allPlanes.map(p => p._id) },
      record_type: 'maintenance',
      date: { $gte: startDate }
    }).populate('plane_id', 'registration').sort({ date: -1 }).limit(10).lean();

    // Maintenance status breakdown
    const maintenanceStatusBreakdown = await (PlaneRecord as any).aggregate([
      { 
        $match: { 
          plane_id: { $in: allPlanes.map(p => p._id) },
          record_type: 'maintenance'
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

    // Maintenance types breakdown
    const maintenanceTypesBreakdown = await (PlaneRecord as any).aggregate([
      { 
        $match: { 
          plane_id: { $in: allPlanes.map(p => p._id) },
          record_type: { $in: ['maintenance', 'airworthiness', 'service_bulletin'] }
        } 
      },
      {
        $group: {
          _id: '$record_type',
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $and: [{ $lt: ['$nextDue', currentDate] }, { $ne: ['$status', 'completed'] }] }, 1, 0] } }
        }
      }
    ]);

    // Updated detailed plane stats (still using organization_id in database for now)
    const detailedPlaneStats = await (Plane as any).aggregate([
      { $match: { organization_id: organizationId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalHours: { $sum: '$total_hours' },
          avgUtilization: { $avg: '$utilization.utilizationRate' },
          avgHoursPerMonth: { $avg: '$utilization.hoursPerMonth' }
        }
      }
    ]);

    // **10. SCHEDULE ADHERENCE** (still using organization_id in database for now)
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
          _id: null,
          total: { $sum: 1 },
          onTime: { $sum: { $cond: ['$onTimeStart', 1, 0] } },
          avgDelayMinutes: { $avg: '$delayMinutes' }
        }
      }
    ]);

    // **11. FLIGHT TYPE BREAKDOWN** (still using organization_id in database for now)
    const flightTypeBreakdown = await FlightSchedule.aggregate([
      { $match: { organization_id: organizationId, created_at: { $gte: startDate } } },
      {
        $group: {
          _id: '$flight_type',
          count: { $sum: 1 },
          totalDuration: { $sum: '$actual_duration' },
          avgDuration: { $avg: '$actual_duration' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // **12. PEAK OPERATING HOURS** (still using organization_id in database for now)
    const peakHours = await FlightSchedule.aggregate([
      { $match: { organization_id: organizationId, created_at: { $gte: startDate } } },
      {
        $project: {
          hour: { $hour: '$scheduled_start_time' },
          dayOfWeek: { $dayOfWeek: '$scheduled_start_time' }
        }
      },
      {
        $group: {
          _id: '$hour',
          count: { $sum: 1 },
          percentage: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // **13. NEW ENROLLMENTS** (still using organization_id in database for now)
    const newEnrollments = await Student.countDocuments({
      organization_id: organizationId,
      enrollmentDate: { $gte: startDate }
    });

    // **14. INSTRUCTOR WORKLOAD** (still using organization_id in database for now)
    const instructorWorkload = await Instructor.aggregate([
      { $match: { organization_id: organizationId, status: 'Active' } },
      {
        $lookup: {
          from: 'flightschedules', // MongoDB collection name is lowercase and pluralized
          localField: '_id',
          foreignField: 'instructor_id',
          pipeline: [
            { $match: { created_at: { $gte: startDate } } }
          ],
          as: 'recentFlights'
        }
      },
      {
        $project: {
          contact_email: 1,
          students: 1,
          utilization: 1,
          teachingHours: 1,
          recentFlightsCount: { $size: '$recentFlights' }
        }
      },
      { $sort: { utilization: -1 } }
    ]);

    // **15. AIRCRAFT UTILIZATION TRENDS** - Fixed to support multiple status values (still using organization_id in database for now)
    const aircraftUtilization = await Plane.aggregate([
      { $match: { organization_id: organizationId, status: { $in: ['active', 'Available'] } } }, // Support both status values
      {
        $lookup: {
          from: 'flightschedules', // Correct MongoDB collection name (lowercase, pluralized)
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
          total_hours: 1,
          'utilization.utilizationRate': 1,
          'utilization.hoursPerMonth': 1,
          recentFlightsCount: { $size: '$recentFlights' },
          recentFlightHours: { $sum: '$recentFlights.actual_duration' }
        }
      },
      { $sort: { 'utilization.utilizationRate': -1 } }
    ]);

    // Debug logging for aircraft utilization
    console.log(JSON.stringify({
      level: 'DEBUG',
      message: 'Aircraft utilization debug',
      auditId: securityContext.auditId,
      activePlanesCount: activePlanes,
      aircraftUtilizationResults: aircraftUtilization.length,
      timeRange: startDate.toISOString(),
      planesByStatus: planesByStatus,
      samplePlaneUtilization: aircraftUtilization.slice(0, 2), // Show first 2 planes for debugging
      timestamp: new Date().toISOString()
    }));

    // Additional debug: Get raw plane data to understand structure (still using organization_id in database for now)
    const samplePlaneData = await (Plane as any).findOne({ organization_id: organizationId }).lean();
    console.log(JSON.stringify({
      level: 'DEBUG',
      message: 'Sample plane data structure',
      auditId: securityContext.auditId,
      samplePlane: samplePlaneData,
      timestamp: new Date().toISOString()
    }));

    // Calculate derived metrics
    const completedFlights = flightStats.find(f => f._id === 'completed')?.count || 0;
    const totalFlights = flightStats.reduce((sum, f) => sum + f.count, 0);
    const completionRate = totalFlights > 0 ? (completedFlights / totalFlights) * 100 : 0;

    // Calculate schedule adherence percentage
    const adherenceData = scheduleAdherence[0];
    const adherencePercentage = adherenceData && adherenceData.total > 0 
      ? (adherenceData.onTime / adherenceData.total) * 100 
      : 0;

    // Calculate total peak hours percentage
    const totalPeakFlights = peakHours.reduce((sum, h) => sum + h.count, 0);
    const peakHoursWithPercentage = peakHours.map(h => ({
      ...h,
      percentage: totalPeakFlights > 0 ? Math.round((h.count / totalPeakFlights) * 100) : 0
    }));

    // Debug logging for upcoming schedule
    console.log(JSON.stringify({
      level: 'DEBUG',
      message: 'Upcoming schedule debug',
      auditId: securityContext.auditId,
      upcomingLessonsCount: upcomingLessons,
      upcomingDetailedCount: upcomingLessonsDetailed.length,
      next7DaysRange: {
        start: now.toISOString(),
        end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      timestamp: new Date().toISOString()
    }));

    // Format the comprehensive response
    const stats = {
      overview: {
        organization_name: organization.name,
        total_students: studentStats.reduce((sum, s) => sum + s.count, 0),
        active_students: studentStats.find(s => s._id === 'Active')?.count || 0,
        total_instructors: instructorStats.reduce((sum, i) => sum + i.count, 0),
        active_instructors: instructorStats.find(i => i._id === 'Active')?.count || 0,
        total_planes: totalPlanes,
        active_planes: activePlanes,
        upcoming_lessons: upcomingLessons,
        upcoming_lessons_next_7_days: upcomingLessonsDetailed.length
      },
      
      flight_operations: {
        total_flights_period: totalFlights,
        completed_flights: completedFlights,
        completion_rate: Math.round(completionRate * 100) / 100,
        recent_flights_7_days: recentFlights,
        schedule_adherence_percentage: Math.round(adherencePercentage * 100) / 100,
        avg_delay_minutes: adherenceData?.avgDelayMinutes || 0,
        flight_status_breakdown: flightStats,
        flight_type_breakdown: flightTypeBreakdown,
        peak_operating_hours: peakHoursWithPercentage.slice(0, 5)
      },
      
      aircraft_efficiency: {
        plane_status_breakdown: planesByStatus,
        detailed_plane_stats: detailedPlaneStats,
        maintenance_alerts: {
          count: maintenanceAlerts.length,
          overdue_count: maintenanceAlerts.filter(alert => alert.is_overdue).length,
          upcoming_count: maintenanceAlerts.filter(alert => !alert.is_overdue && alert.days_until_maintenance <= 30).length,
          alerts: maintenanceAlerts
        },
        recent_maintenance_activity: recentMaintenanceActivity.map(record => ({
          id: record._id,
          registration: record.plane_id?.registration,
          title: record.title,
          description: record.description,
          status: record.status,
          date: record.date,
          aircraft_hours: record.aircraftHours,
          parts_replaced: record.partsReplaced?.length || 0
        })),
        maintenance_status_breakdown: maintenanceStatusBreakdown,
        maintenance_types_breakdown: maintenanceTypesBreakdown,
        aircraft_utilization: aircraftUtilization,
        average_utilization_rate: detailedPlaneStats.reduce((sum, p) => sum + (p.avgUtilization || 0), 0) / detailedPlaneStats.length || 0
      },
      
      instructor_efficiency: {
        instructor_status_breakdown: instructorStats,
        total_teaching_hours: instructorStats.reduce((sum, i) => sum + i.totalTeachingHours, 0),
        total_flight_hours: instructorStats.reduce((sum, i) => sum + i.totalFlightHours, 0),
        average_utilization: instructorStats.reduce((sum, i) => sum + (i.avgUtilization || 0), 0) / instructorStats.length || 0,
        total_students_taught: instructorStats.reduce((sum, i) => sum + i.totalStudents, 0),
        instructor_workload: instructorWorkload,
        avg_students_per_instructor: instructorWorkload.length > 0 
          ? instructorWorkload.reduce((sum, i) => sum + i.students, 0) / instructorWorkload.length 
          : 0
      },
      
      student_metrics: {
        student_status_breakdown: studentStats,
        new_enrollments_period: newEnrollments,
        students_by_program: await Student.aggregate([
          { $match: { organization_id: organizationId } },
          {
            $group: {
              _id: '$program',
              count: { $sum: 1 },
              active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } }
            }
          }
        ])
      },
      
      operational_metrics: {
        total_scheduled_hours: flightStats.reduce((sum, f) => sum + (f.totalScheduledDuration || 0), 0),
        total_actual_hours: flightStats.reduce((sum, f) => sum + (f.totalActualDuration || 0), 0),
        average_flight_duration: flightStats.find(f => f._id === 'completed')?.avgActualDuration || 0,
        capacity_utilization: totalPlanes > 0 && parseInt(timeRange) > 0 
          ? Math.round((totalFlights / (totalPlanes * 8 * parseInt(timeRange))) * 100) 
          : 0, // Assuming 8 hours per day per plane
        efficiency_ratio: flightStats.reduce((sum, f) => sum + (f.totalScheduledDuration || 0), 0) > 0
          ? Math.round((flightStats.reduce((sum, f) => sum + (f.totalActualDuration || 0), 0) / flightStats.reduce((sum, f) => sum + (f.totalScheduledDuration || 0), 0)) * 100)
          : 0
      },
      
      upcoming_schedule: {
        next_7_days: upcomingLessonsDetailed.map(lesson => ({
          id: lesson._id,
          scheduled_start: lesson.scheduled_start_time,
          flight_type: lesson.flight_type,
          student_email: lesson.student_id?.contact_email,
          instructor_email: lesson.instructor_id?.contact_email,
          aircraft_registration: lesson.plane_id?.registration,
          status: lesson.status
        }))
      },
      
      ...(includeFinancials && {
        financial_metrics: {
          revenue_breakdown: financialStats,
          total_revenue_period: financialStats?.reduce((sum, f) => sum + f.totalAmount, 0) || 0,
          average_invoice_value: financialStats && financialStats.length > 0 
            ? financialStats.reduce((sum, f) => sum + f.avgAmount, 0) / financialStats.length 
            : 0,
          pending_invoices: financialStats?.find(f => f._id === 'pending')?.count || 0,
          approved_invoices: financialStats?.find(f => f._id === 'approved')?.count || 0,
          monthly_revenue_trend: monthlyRevenue
        }
      })
    };

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Organization stats retrieved successfully',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      organizationName: organization.name,
      timeRange,
      includeFinancials,
      totalStudents: stats.overview.total_students,
      totalInstructors: stats.overview.total_instructors,
      totalPlanes: stats.overview.total_planes,
      upcomingLessons: stats.overview.upcoming_lessons,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Organization statistics retrieved successfully',
      data: {
        stats,
        metadata: {
          organization_id: params.organization,
          organization_name: organization.name,
          time_range_days: parseInt(timeRange),
          start_date: startDate.toISOString(),
          end_date: now.toISOString(),
          includes_financials: includeFinancials,
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
      message: 'Error retrieving organization stats',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, STATS_SECURITY_CONFIG); 