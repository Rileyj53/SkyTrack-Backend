import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import Instructor from '@/models/Instructor';
import FlightSchedule from '@/models/FlightSchedule';
import Student from '@/models/Student';
import FlightInvoice from '@/models/FlightInvoice';

// Security configuration for instructor stats endpoints
const INSTRUCTOR_STATS_SECURITY_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  requireCSRF: false, // GET operations don't need CSRF
  allowedRoles: ['sys_admin', 'school_admin', 'club_admin', 'instructor'],
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'confidential',
  rateLimiting: {
    maxRequests: 50,
    windowMs: 60000,
    slidingWindow: true
  }
};

// GET /api/organizations/[organizationId]/instructors/stats - Get comprehensive instructor statistics
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing instructor stats request',
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
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || '30'; // Default to 30 days
    const includeFinancials = searchParams.get('include_financials') === 'true';
    const includeWorkload = searchParams.get('include_workload') === 'true';
    
    // Calculate date ranges
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - parseInt(timeRange));
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // **1. OVERVIEW STATISTICS** (still using organization_id in database for now)
    const [totalInstructors, activeInstructors, newInstructors, totalTeachingHours, totalFlightHours] = await Promise.all([
      Instructor.countDocuments({ organization_id: organizationId }),
      Instructor.countDocuments({ organization_id: organizationId, status: 'Active' }),
      Instructor.countDocuments({ 
        organization_id: organizationId, 
        createdAt: { $gte: startDate } 
      }),
      Instructor.aggregate([
        { $match: { organization_id: organizationId } },
        { $group: { _id: null, total: { $sum: '$teachingHours' } } }
      ]).then(result => result[0]?.total || 0),
      Instructor.aggregate([
        { $match: { organization_id: organizationId } },
        { $group: { _id: null, total: { $sum: '$flightHours' } } }
      ]).then(result => result[0]?.total || 0)
    ]);

    // **2. STATUS BREAKDOWN** (still using organization_id in database for now)
    const statusBreakdown = await Instructor.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgTeachingHours: { $avg: '$teachingHours' },
          avgFlightHours: { $avg: '$flightHours' },
          avgUtilization: { $avg: '$utilization' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // **3. CERTIFICATION BREAKDOWN** (still using organization_id in database for now)
    const certificationBreakdown = await Instructor.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $group: {
          _id: null,
          certifications: { $push: '$certifications' }
        }
      },
      {
        $project: {
          certificationCounts: {
            $reduce: {
              input: '$certifications',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: {
                      $map: {
                        input: '$$this',
                        as: 'cert',
                        in: { k: '$$cert', v: 1 }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    // **4. SPECIALTY BREAKDOWN** (still using organization_id in database for now)
    const specialtyBreakdown = await Instructor.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $group: {
          _id: null,
          specialties: { $push: '$specialties' }
        }
      },
      {
        $project: {
          specialtyCounts: {
            $reduce: {
              input: '$specialties',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: {
                      $map: {
                        input: '$$this',
                        as: 'spec',
                        in: { k: '$$spec', v: 1 }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    // **5. AVAILABILITY BREAKDOWN** (still using organization_id in database for now)
    const availabilityBreakdown = await Instructor.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $group: {
          _id: '$availability',
          count: { $sum: 1 },
          avgUtilization: { $avg: '$utilization' },
          avgStudents: { $avg: '$students' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // **6. FLIGHT ACTIVITY** (still using organization_id in database for now)
    const flightActivity = await FlightSchedule.aggregate([
      { 
        $match: { 
          organization_id: organizationId,
          created_at: { $gte: startDate }
        } 
      },
      {
        $lookup: {
          from: 'instructors',
          localField: 'instructor_id',
          foreignField: '_id',
          as: 'instructor_info'
        }
      },
      {
        $group: {
          _id: '$instructor_id',
          totalFlights: { $sum: 1 },
          completedFlights: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          totalHours: { $sum: '$actual_duration' },
          avgFlightDuration: { $avg: '$actual_duration' },
          lastFlightDate: { $max: '$actual_end_time' },
          instructorStatus: { $first: { $arrayElemAt: ['$instructor_info.status', 0] } },
          instructorEmail: { $first: { $arrayElemAt: ['$instructor_info.contact_email', 0] } }
        }
      },
      {
        $group: {
          _id: '$instructorStatus',
          instructorCount: { $sum: 1 },
          totalFlights: { $sum: '$totalFlights' },
          completedFlights: { $sum: '$completedFlights' },
          totalHours: { $sum: '$totalHours' },
          avgFlightsPerInstructor: { $avg: '$totalFlights' },
          avgHoursPerInstructor: { $avg: '$totalHours' }
        }
      }
    ]);

    // **7. STUDENT ASSIGNMENTS** (still using organization_id in database for now)
    const studentAssignments = await Student.aggregate([
      { $match: { organization_id: organizationId, status: 'Active' } },
      {
        $lookup: {
          from: 'flightschedules',
          localField: '_id',
          foreignField: 'student_id',
          pipeline: [
            { $match: { created_at: { $gte: startDate } } },
            { $sort: { created_at: -1 } },
            { $limit: 1 }
          ],
          as: 'lastFlight'
        }
      },
      {
        $group: {
          _id: { $arrayElemAt: ['$lastFlight.instructor_id', 0] },
          studentCount: { $sum: 1 },
          students: { $push: { contact_email: '$contact_email', program: '$program' } }
        }
      },
      {
        $lookup: {
          from: 'instructors',
          localField: '_id',
          foreignField: '_id',
          as: 'instructor_info'
        }
      },
      {
        $project: {
          instructorEmail: { $arrayElemAt: ['$instructor_info.contact_email', 0] },
          instructorStatus: { $arrayElemAt: ['$instructor_info.status', 0] },
          studentCount: 1,
          students: 1
        }
      },
      { $sort: { studentCount: -1 } }
    ]);

    // **8. PERFORMANCE METRICS** (still using organization_id in database for now)
    const performanceMetrics = await FlightSchedule.aggregate([
      { 
        $match: { 
          organization_id: organizationId,
          status: 'completed',
          actual_start_time: { $ne: null },
          created_at: { $gte: startDate }
        } 
      },
      {
        $lookup: {
          from: 'instructors',
          localField: 'instructor_id',
          foreignField: '_id',
          as: 'instructor_info'
        }
      },
      {
        $group: {
          _id: '$instructor_id',
          totalFlights: { $sum: 1 },
          totalHours: { $sum: '$actual_duration' },
          avgFlightDuration: { $avg: '$actual_duration' },
          onTimeFlights: {
            $sum: {
              $cond: [
                { $lte: [{ $abs: { $subtract: ['$actual_start_time', '$scheduled_start_time'] } }, 15 * 60 * 1000] },
                1,
                0
              ]
            }
          },
          instructorStatus: { $first: { $arrayElemAt: ['$instructor_info.status', 0] } },
          instructorEmail: { $first: { $arrayElemAt: ['$instructor_info.contact_email', 0] } }
        }
      },
      {
        $group: {
          _id: '$instructorStatus',
          instructorCount: { $sum: 1 },
          totalFlights: { $sum: '$totalFlights' },
          totalHours: { $sum: '$totalHours' },
          avgFlightsPerInstructor: { $avg: '$totalFlights' },
          avgHoursPerInstructor: { $avg: '$totalHours' },
          avgFlightDuration: { $avg: '$avgFlightDuration' },
          onTimeRate: { $avg: { $divide: ['$onTimeFlights', '$totalFlights'] } }
        }
      }
    ]);

    // **9. WORKLOAD ANALYSIS** (if requested) (still using organization_id in database for now)
    let workloadStats = null;
    if (includeWorkload) {
      workloadStats = await Instructor.aggregate([
        { $match: { organization_id: organizationId, status: 'Active' } },
        {
          $lookup: {
            from: 'flightschedules',
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
            flightHours: 1,
            availability: 1,
            recentFlightsCount: { $size: '$recentFlights' },
            recentFlightHours: { $sum: '$recentFlights.actual_duration' },
            workloadScore: {
              $add: [
                { $multiply: ['$utilization', 0.4] },
                { $multiply: [{ $divide: ['$students', 10] }, 0.3] },
                { $multiply: [{ $divide: [{ $size: '$recentFlights' }, 20] }, 0.3] }
              ]
            }
          }
        },
        { $sort: { workloadScore: -1 } }
      ]);
    }

    // **10. FINANCIAL METRICS** (if requested) (still using organization_id in database for now)
    let financialStats = null;
    if (includeFinancials) {
      financialStats = await FlightInvoice.aggregate([
        { 
          $match: { 
            organization_id: organizationId,
            created_at: { $gte: startDate }
          } 
        },
        {
          $lookup: {
            from: 'flightschedules',
            localField: 'flight_schedule_id',
            foreignField: '_id',
            as: 'flight_info'
          }
        },
        {
          $lookup: {
            from: 'instructors',
            localField: 'flight_info.instructor_id',
            foreignField: '_id',
            as: 'instructor_info'
          }
        },
        {
          $group: {
            _id: { $arrayElemAt: ['$instructor_info._id', 0] },
            totalInvoiced: { $sum: '$total_amount' },
            totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total_amount', 0] } },
            totalPending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$total_amount', 0] } },
            invoiceCount: { $sum: 1 },
            avgInvoiceValue: { $avg: '$total_amount' },
            instructorStatus: { $first: { $arrayElemAt: ['$instructor_info.status', 0] } },
            instructorEmail: { $first: { $arrayElemAt: ['$instructor_info.contact_email', 0] } }
          }
        },
        {
          $group: {
            _id: '$instructorStatus',
            instructorCount: { $sum: 1 },
            totalInvoiced: { $sum: '$totalInvoiced' },
            totalPaid: { $sum: '$totalPaid' },
            totalPending: { $sum: '$totalPending' },
            avgInvoiceValue: { $avg: '$avgInvoiceValue' },
            avgInvoicesPerInstructor: { $avg: '$invoiceCount' }
          }
        }
      ]);
    }

    // **11. RECENT ACTIVITY** (still using organization_id in database for now)
    const recentActivity = await Instructor.aggregate([
      { 
        $match: { 
          organization_id: organizationId,
          updatedAt: { $gte: startDate }
        } 
      },
      {
        $lookup: {
          from: 'flightschedules',
          localField: '_id',
          foreignField: 'instructor_id',
          pipeline: [
            { $match: { created_at: { $gte: startDate } } },
            { $sort: { created_at: -1 } },
            { $limit: 1 }
          ],
          as: 'lastFlight'
        }
      },
      {
        $project: {
          contact_email: 1,
          status: 1,
          availability: 1,
          students: 1,
          utilization: 1,
          teachingHours: 1,
          flightHours: 1,
          updatedAt: 1,
          lastFlightDate: { $arrayElemAt: ['$lastFlight.actual_end_time', 0] }
        }
      },
      { $sort: { updatedAt: -1 } },
      { $limit: 10 }
    ]);

    // **12. EFFICIENCY METRICS** (still using organization_id in database for now)
    const efficiencyMetrics = await Instructor.aggregate([
      { $match: { organization_id: organizationId, status: 'Active' } },
      {
        $lookup: {
          from: 'flightschedules',
          localField: '_id',
          foreignField: 'instructor_id',
          pipeline: [
            { $match: { status: 'completed', created_at: { $gte: startDate } } }
          ],
          as: 'completedFlights'
        }
      },
      {
        $project: {
          contact_email: 1,
          students: 1,
          utilization: 1,
          teachingHours: 1,
          flightHours: 1,
          completedFlightsCount: { $size: '$completedFlights' },
          completedFlightHours: { $sum: '$completedFlights.actual_duration' },
          efficiencyRatio: {
            $cond: [
              { $gt: ['$students', 0] },
              { $divide: [{ $size: '$completedFlights' }, '$students'] },
              0
            ]
          }
        }
      },
      { $sort: { efficiencyRatio: -1 } }
    ]);

    // **13. HOURLY RATE ANALYSIS** (still using organization_id in database for now)
    const hourlyRateAnalysis = await Instructor.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $group: {
          _id: null,
          avgPrimaryRate: { $avg: '$hourlyRates.primary' },
          avgInstrumentRate: { $avg: '$hourlyRates.instrument' },
          avgAdvancedRate: { $avg: '$hourlyRates.advanced' },
          avgMultiEngineRate: { $avg: '$hourlyRates.multiEngine' },
          minPrimaryRate: { $min: '$hourlyRates.primary' },
          maxPrimaryRate: { $max: '$hourlyRates.primary' },
          minInstrumentRate: { $min: '$hourlyRates.instrument' },
          maxInstrumentRate: { $max: '$hourlyRates.instrument' }
        }
      }
    ]);

    // Calculate derived metrics
    const avgUtilization = statusBreakdown.reduce((sum, s) => sum + (s.avgUtilization || 0), 0) / statusBreakdown.length || 0;
    const avgStudentsPerInstructor = studentAssignments.reduce((sum, s) => sum + s.studentCount, 0) / studentAssignments.length || 0;

    // Format the comprehensive response
    const stats = {
      overview: {
        total_instructors: totalInstructors,
        active_instructors: activeInstructors,
        new_instructors_period: newInstructors,
        total_teaching_hours: totalTeachingHours,
        total_flight_hours: totalFlightHours,
        average_utilization: Math.round(avgUtilization * 100) / 100,
        average_students_per_instructor: Math.round(avgStudentsPerInstructor * 100) / 100
      },
      
      status_breakdown: statusBreakdown,
      
      certification_breakdown: certificationBreakdown[0]?.certificationCounts || {},
      
      specialty_breakdown: specialtyBreakdown[0]?.specialtyCounts || {},
      
      availability_breakdown: availabilityBreakdown,
      
      flight_activity: {
        by_status: flightActivity,
        total_flights_period: flightActivity.reduce((sum, f) => sum + f.totalFlights, 0),
        completed_flights_period: flightActivity.reduce((sum, f) => sum + f.completedFlights, 0),
        total_hours_period: flightActivity.reduce((sum, f) => sum + f.totalHours, 0)
      },
      
      student_assignments: {
        assignments: studentAssignments.map(assignment => ({
          instructor_email: assignment.instructorEmail,
          instructor_status: assignment.instructorStatus,
          student_count: assignment.studentCount,
          students: assignment.students
        })),
        total_assigned_students: studentAssignments.reduce((sum, a) => sum + a.studentCount, 0),
        average_students_per_instructor: avgStudentsPerInstructor
      },
      
      performance_metrics: {
        by_status: performanceMetrics,
        overall_on_time_rate: performanceMetrics.length > 0 
          ? performanceMetrics.reduce((sum, p) => sum + p.onTimeRate, 0) / performanceMetrics.length 
          : 0,
        avg_flights_per_instructor: flightActivity.length > 0 
          ? flightActivity.reduce((sum, f) => sum + f.avgFlightsPerInstructor, 0) / flightActivity.length 
          : 0
      },
      
      efficiency_metrics: {
        top_performers: efficiencyMetrics.slice(0, 5).map(instructor => ({
          contact_email: instructor.contact_email,
          students: instructor.students,
          utilization: instructor.utilization,
          completed_flights: instructor.completedFlightsCount,
          efficiency_ratio: Math.round(instructor.efficiencyRatio * 100) / 100
        })),
        average_efficiency_ratio: efficiencyMetrics.length > 0 
          ? efficiencyMetrics.reduce((sum, e) => sum + e.efficiencyRatio, 0) / efficiencyMetrics.length 
          : 0
      },
      
      hourly_rate_analysis: hourlyRateAnalysis[0] || {},
      
      recent_activity: recentActivity.map(instructor => ({
        contact_email: instructor.contact_email,
        status: instructor.status,
        availability: instructor.availability,
        students: instructor.students,
        utilization: instructor.utilization,
        teaching_hours: instructor.teachingHours,
        flight_hours: instructor.flightHours,
        last_updated: instructor.updatedAt,
        last_flight_date: instructor.lastFlightDate
      })),
      
      ...(includeWorkload && {
        workload_analysis: {
          by_instructor: workloadStats.map(instructor => ({
            contact_email: instructor.contact_email,
            students: instructor.students,
            utilization: instructor.utilization,
            recent_flights: instructor.recentFlightsCount,
            recent_flight_hours: instructor.recentFlightHours,
            workload_score: Math.round(instructor.workloadScore * 100) / 100
          })),
          average_workload_score: workloadStats.length > 0 
            ? workloadStats.reduce((sum, w) => sum + w.workloadScore, 0) / workloadStats.length 
            : 0
        }
      }),
      
      ...(includeFinancials && {
        financial_metrics: {
          by_status: financialStats,
          total_invoiced_period: financialStats.reduce((sum, f) => sum + f.totalInvoiced, 0),
          total_paid_period: financialStats.reduce((sum, f) => sum + f.totalPaid, 0),
          total_pending_period: financialStats.reduce((sum, f) => sum + f.totalPending, 0)
        }
      })
    };

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Instructor stats retrieved successfully',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      timeRange,
      includeFinancials,
      includeWorkload,
      totalInstructors,
      activeInstructors,
      newInstructors,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Instructor statistics retrieved successfully',
      data: {
        stats,
        metadata: {
          organization_id: params.organization,
          time_range_days: parseInt(timeRange),
          start_date: startDate.toISOString(),
          end_date: now.toISOString(),
          includes_financials: includeFinancials,
          includes_workload: includeWorkload,
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
      message: 'Error retrieving instructor stats',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, INSTRUCTOR_STATS_SECURITY_CONFIG); 