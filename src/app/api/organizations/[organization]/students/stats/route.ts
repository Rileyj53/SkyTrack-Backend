import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import Student from '@/models/Student';
import FlightSchedule from '@/models/FlightSchedule';
import FlightInvoice from '@/models/FlightInvoice';
import Program from '@/models/Program';
import { School } from '@/models/School';

// Security configuration for student stats endpoints
const STUDENT_STATS_SECURITY_CONFIG: SecurityConfig = {
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

// GET /api/organizations/[organizationId]/students/stats - Get comprehensive student statistics
export const GET = secureApiRoute(async (
  request: NextRequest,
  { params, securityContext }: { params: { organization: string }, securityContext: any }
) => {
  const startTime = Date.now();
  
  // Establish database connection with retry logic
  await connectDB();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing student stats request',
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
    const includeProgress = searchParams.get('include_progress') === 'true';
    
    // Calculate date ranges
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - parseInt(timeRange));
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // **1. OVERVIEW STATISTICS** (still using organization_id in database for now)
    const [totalStudents, activeStudents, newEnrollments, graduatedStudents] = await Promise.all([
      Student.countDocuments({ organization_id: organizationId }),
      Student.countDocuments({ organization_id: organizationId, status: 'Active' }),
      Student.countDocuments({ 
        organization_id: organizationId, 
        enrollmentDate: { $gte: startDate } 
      }),
      Student.countDocuments({ 
        organization_id: organizationId, 
        status: 'Graduated',
        updatedAt: { $gte: startDate }
      })
    ]);

    // **2. STATUS BREAKDOWN** (still using organization_id in database for now)
    const statusBreakdown = await Student.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgEnrollmentDate: { $avg: { $dateToString: { format: '%Y-%m', date: '$enrollmentDate' } } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // **3. PROGRAM BREAKDOWN** (still using organization_id in database for now)
    const programBreakdown = await Student.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $group: {
          _id: '$program',
          count: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          graduated: { $sum: { $cond: [{ $eq: ['$status', 'Graduated'] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // **3.1. ENHANCED PROGRAM ANALYSIS** - Get programs from Program model and calculate comprehensive stats
    const availablePrograms = await (Program as any).find({ organization_id: organizationId }).select('program_name').lean();
    const programNames = availablePrograms.map(p => p.program_name);
    
    // Get detailed program statistics including progress
    const enhancedProgramStats = await Student.aggregate([
      { $match: { organization_id: organizationId } },
      {
        $project: {
          program: 1,
          status: 1,
          enrollmentDate: 1,
          progress: 1,
          stage: 1,
          nextMilestone: 1,
          contact_email: 1
        }
      },
      {
        $group: {
          _id: '$program',
          totalStudents: { $sum: 1 },
          activeStudents: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          graduatedStudents: { $sum: { $cond: [{ $eq: ['$status', 'Graduated'] }, 1, 0] } },
          inactiveStudents: { $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] } },
          avgEnrollmentDate: { $avg: { $dateToString: { format: '%Y-%m', date: '$enrollmentDate' } } },
          students: {
            $push: {
              contact_email: '$contact_email',
              status: '$status',
              stage: '$stage',
              nextMilestone: '$nextMilestone',
              progress: '$progress',
              enrollmentDate: '$enrollmentDate'
            }
          }
        }
      }
    ]);

    // Calculate progress metrics for each program
    const programStatsWithProgress = enhancedProgramStats.map(program => {
      const progressData = program.students.filter(student => 
        student.status === 'Active' && student.progress && student.progress.requirements
      );

      let avgProgress = 0;
      let stageBreakdown = {};
      let milestoneBreakdown = {};
      let avgTimeToCurrentStage = 0;

      if (progressData.length > 0) {
        // Calculate average progress
        const totalProgress = progressData.reduce((sum, student) => {
          if (student.progress && student.progress.requirements) {
            const completedHours = student.progress.requirements.reduce((total, req) => total + req.completed_hours, 0);
            const totalHours = student.progress.requirements.reduce((total, req) => total + req.total_hours, 0);
            return sum + (totalHours > 0 ? (completedHours / totalHours) * 100 : 0);
          }
          return sum;
        }, 0);
        avgProgress = totalProgress / progressData.length;

        // Calculate stage breakdown
        stageBreakdown = progressData.reduce((acc, student) => {
          acc[student.stage] = (acc[student.stage] || 0) + 1;
          return acc;
        }, {});

        // Calculate milestone breakdown
        milestoneBreakdown = progressData.reduce((acc, student) => {
          acc[student.nextMilestone] = (acc[student.nextMilestone] || 0) + 1;
          return acc;
        }, {});

        // Calculate average time to current stage
        const now = new Date();
        const timeToStage = progressData.reduce((sum, student) => {
          if (student.enrollmentDate) {
            const enrollmentDate = new Date(student.enrollmentDate);
            return sum + (now.getTime() - enrollmentDate.getTime()) / (1000 * 60 * 60 * 24);
          }
          return sum;
        }, 0);
        avgTimeToCurrentStage = timeToStage / progressData.length;
      }

      return {
        program: program._id,
        totalStudents: program.totalStudents,
        activeStudents: program.activeStudents,
        graduatedStudents: program.graduatedStudents,
        inactiveStudents: program.inactiveStudents,
        avgEnrollmentDate: program.avgEnrollmentDate,
        avgProgress: Math.round(avgProgress * 100) / 100,
        stageBreakdown,
        milestoneBreakdown,
        avgTimeToCurrentStage: Math.round(avgTimeToCurrentStage),
        completionRate: program.totalStudents > 0 ? Math.round((program.graduatedStudents / program.totalStudents) * 100 * 100) / 100 : 0,
        activeRate: program.totalStudents > 0 ? Math.round((program.activeStudents / program.totalStudents) * 100 * 100) / 100 : 0
      };
    });

    // Add programs with zero students
    const allPrograms = programNames.map(programName => {
      const existingProgram = programStatsWithProgress.find(p => p.program === programName);
      if (existingProgram) {
        return existingProgram;
      }
      return {
        program: programName,
        totalStudents: 0,
        activeStudents: 0,
        graduatedStudents: 0,
        inactiveStudents: 0,
        avgEnrollmentDate: null,
        avgProgress: 0,
        stageBreakdown: {},
        milestoneBreakdown: {},
        avgTimeToCurrentStage: 0,
        completionRate: 0,
        activeRate: 0
      };
    });

    // Sort by total students (descending)
    allPrograms.sort((a, b) => b.totalStudents - a.totalStudents);

    // **4. ENROLLMENT TRENDS** (still using organization_id in database for now)
    const enrollmentTrends = await Student.aggregate([
      { 
        $match: { 
          organization_id: organizationId,
          enrollmentDate: { $gte: new Date(now.getFullYear(), 0, 1) } // This year
        } 
      },
      {
        $group: {
          _id: { 
            year: { $year: '$enrollmentDate' },
            month: { $month: '$enrollmentDate' }
          },
          enrollments: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // **5. FLIGHT ACTIVITY** (still using organization_id in database for now)
    const flightActivity = await FlightSchedule.aggregate([
      { 
        $match: { 
          organization_id: organizationId,
          created_at: { $gte: startDate }
        } 
      },
      {
        $lookup: {
          from: 'students',
          localField: 'student_id',
          foreignField: '_id',
          as: 'student_info'
        }
      },
      {
        $group: {
          _id: '$student_id',
          totalFlights: { $sum: 1 },
          completedFlights: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          totalHours: { $sum: '$actual_duration' },
          avgFlightDuration: { $avg: '$actual_duration' },
          lastFlightDate: { $max: '$actual_end_time' },
          studentStatus: { $first: { $arrayElemAt: ['$student_info.status', 0] } }
        }
      },
      {
        $group: {
          _id: '$studentStatus',
          studentCount: { $sum: 1 },
          totalFlights: { $sum: '$totalFlights' },
          completedFlights: { $sum: '$completedFlights' },
          totalHours: { $sum: '$totalHours' },
          avgFlightsPerStudent: { $avg: '$totalFlights' },
          avgHoursPerStudent: { $avg: '$totalHours' }
        }
      }
    ]);

    // **6. PROGRESS TRACKING** (if requested) (still using organization_id in database for now)
    let progressStats = null;
    if (includeProgress) {
      progressStats = await Student.aggregate([
        { $match: { organization_id: organizationId, status: 'Active' } },
        {
          $project: {
            program: 1,
            stage: 1,
            nextMilestone: 1,
            progress: 1,
            enrollmentDate: 1,
            status: 1
          }
        },
        {
          $group: {
            _id: '$program',
            students: { $sum: 1 },
            stages: {
              $push: {
                stage: '$stage',
                nextMilestone: '$nextMilestone',
                progress: '$progress'
              }
            }
          }
        }
      ]);

      // Calculate progress metrics for each program
      progressStats = progressStats.map(program => {
        const stageBreakdown = program.stages.reduce((acc, student) => {
          acc[student.stage] = (acc[student.stage] || 0) + 1;
          return acc;
        }, {});

        const milestoneBreakdown = program.stages.reduce((acc, student) => {
          acc[student.nextMilestone] = (acc[student.nextMilestone] || 0) + 1;
          return acc;
        }, {});

        const avgProgress = program.stages.reduce((sum, student) => {
          if (student.progress && student.progress.requirements) {
            const completedHours = student.progress.requirements.reduce((total, req) => total + req.completed_hours, 0);
            const totalHours = student.progress.requirements.reduce((total, req) => total + req.total_hours, 0);
            return sum + (totalHours > 0 ? (completedHours / totalHours) * 100 : 0);
          }
          return sum;
        }, 0) / program.students;

        return {
          program: program._id,
          students: program.students,
          stageBreakdown,
          milestoneBreakdown,
          averageProgress: Math.round(avgProgress * 100) / 100
        };
      });
    }

    // **7. CERTIFICATION BREAKDOWN** (still using organization_id in database for now)
    const certificationBreakdown = await Student.aggregate([
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

    // **8. FINANCIAL METRICS** (if requested) (still using organization_id in database for now)
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
            from: 'students',
            localField: 'student_id',
            foreignField: '_id',
            as: 'student_info'
          }
        },
        {
          $group: {
            _id: '$student_id',
            totalInvoiced: { $sum: '$total_amount' },
            totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total_amount', 0] } },
            totalPending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$total_amount', 0] } },
            invoiceCount: { $sum: 1 },
            avgInvoiceValue: { $avg: '$total_amount' },
            studentStatus: { $first: { $arrayElemAt: ['$student_info.status', 0] } },
            studentProgram: { $first: { $arrayElemAt: ['$student_info.program', 0] } }
          }
        },
        {
          $group: {
            _id: '$studentStatus',
            studentCount: { $sum: 1 },
            totalInvoiced: { $sum: '$totalInvoiced' },
            totalPaid: { $sum: '$totalPaid' },
            totalPending: { $sum: '$totalPending' },
            avgInvoiceValue: { $avg: '$avgInvoiceValue' },
            avgInvoicesPerStudent: { $avg: '$invoiceCount' }
          }
        }
      ]);

      // Program-based financial breakdown
      const programFinancials = await FlightInvoice.aggregate([
        { 
          $match: { 
            organization_id: organizationId,
            created_at: { $gte: startDate }
          } 
        },
        {
          $lookup: {
            from: 'students',
            localField: 'student_id',
            foreignField: '_id',
            as: 'student_info'
          }
        },
        {
          $group: {
            _id: { $arrayElemAt: ['$student_info.program', 0] },
            totalInvoiced: { $sum: '$total_amount' },
            totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total_amount', 0] } },
            studentCount: { $addToSet: '$student_id' }
          }
        },
        {
          $project: {
            program: '$_id',
            totalInvoiced: 1,
            totalPaid: 1,
            studentCount: { $size: '$studentCount' },
            avgRevenuePerStudent: { $divide: ['$totalInvoiced', { $size: '$studentCount' }] }
          }
        }
      ]);

      financialStats = {
        byStatus: financialStats,
        byProgram: programFinancials
      };
    }

    // **9. RECENT ACTIVITY** (still using organization_id in database for now)
    const recentActivity = await Student.aggregate([
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
        $project: {
          contact_email: 1,
          program: 1,
          status: 1,
          stage: 1,
          nextMilestone: 1,
          enrollmentDate: 1,
          updatedAt: 1,
          lastFlightDate: { $arrayElemAt: ['$lastFlight.actual_end_time', 0] }
        }
      },
      { $sort: { updatedAt: -1 } },
      { $limit: 10 }
    ]);

    // **10. PERFORMANCE METRICS** (still using organization_id in database for now)
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
          from: 'students',
          localField: 'student_id',
          foreignField: '_id',
          as: 'student_info'
        }
      },
      {
        $group: {
          _id: '$student_id',
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
          studentStatus: { $first: { $arrayElemAt: ['$student_info.status', 0] } },
          studentProgram: { $first: { $arrayElemAt: ['$student_info.program', 0] } }
        }
      },
      {
        $group: {
          _id: '$studentStatus',
          studentCount: { $sum: 1 },
          totalFlights: { $sum: '$totalFlights' },
          totalHours: { $sum: '$totalHours' },
          avgFlightsPerStudent: { $avg: '$totalFlights' },
          avgHoursPerStudent: { $avg: '$totalHours' },
          avgFlightDuration: { $avg: '$avgFlightDuration' },
          onTimeRate: { $avg: { $divide: ['$onTimeFlights', '$totalFlights'] } }
        }
      }
    ]);

    // **11. ENROLLMENT DURATION ANALYSIS** (still using organization_id in database for now)
    const enrollmentDuration = await Student.aggregate([
      { 
        $match: { 
          organization_id: organizationId,
          status: { $in: ['Graduated', 'Active'] },
          enrollmentDate: { $exists: true, $ne: null }
        } 
      },
      {
        $project: {
          enrollmentDate: 1,
          status: 1,
          program: 1,
          durationDays: {
            $cond: [
              { $eq: ['$status', 'Graduated'] },
              { $divide: [{ $subtract: ['$updatedAt', '$enrollmentDate'] }, 1000 * 60 * 60 * 24] },
              { $divide: [{ $subtract: [new Date(), '$enrollmentDate'] }, 1000 * 60 * 60 * 24] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgDurationDays: { $avg: '$durationDays' },
          minDurationDays: { $min: '$durationDays' },
          maxDurationDays: { $max: '$durationDays' }
        }
      }
    ]);

    // **12. STUDENT PERFORMANCE TRENDS** (still using organization_id in database for now)
    const performanceTrends = await FlightSchedule.aggregate([
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
          from: 'students',
          localField: 'student_id',
          foreignField: '_id',
          as: 'student_info'
        }
      },
      {
        $project: {
          month: { $dateToString: { format: '%Y-%m', date: '$actual_start_time' } },
          program: { $arrayElemAt: ['$student_info.program', 0] },
          onTime: {
            $lte: [
              { $abs: { $subtract: ['$actual_start_time', '$scheduled_start_time'] } },
              15 * 60 * 1000 // 15 minutes in milliseconds
            ]
          },
          duration: '$actual_duration'
        }
      },
      {
        $group: {
          _id: { month: '$month', program: '$program' },
          totalFlights: { $sum: 1 },
          onTimeFlights: { $sum: { $cond: ['$onTime', 1, 0] } },
          avgDuration: { $avg: '$duration' },
          totalHours: { $sum: '$duration' }
        }
      },
      {
        $group: {
          _id: '$_id.month',
          programs: {
            $push: {
              program: '$_id.program',
              totalFlights: '$totalFlights',
              onTimeFlights: '$onTimeFlights',
              avgDuration: '$avgDuration',
              totalHours: '$totalHours',
              onTimeRate: { $divide: ['$onTimeFlights', '$totalFlights'] }
            }
          },
          totalFlights: { $sum: '$totalFlights' },
          totalOnTimeFlights: { $sum: '$onTimeFlights' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // **13. STUDENT-INSTRUCTOR ASSIGNMENT ANALYSIS** (still using organization_id in database for now)
    const instructorAssignmentAnalysis = await FlightSchedule.aggregate([
      { 
        $match: { 
          organization_id: organizationId,
          created_at: { $gte: startDate }
        } 
      },
      {
        $lookup: {
          from: 'students',
          localField: 'student_id',
          foreignField: '_id',
          as: 'student_info'
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
          _id: {
            student: '$student_id',
            instructor: '$instructor_id'
          },
          studentProgram: { $first: { $arrayElemAt: ['$student_info.program', 0] } },
          instructorEmail: { $first: { $arrayElemAt: ['$instructor_info.contact_email', 0] } },
          totalFlights: { $sum: 1 },
          completedFlights: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          totalHours: { $sum: '$actual_duration' }
        }
      },
      {
        $group: {
          _id: '$studentProgram',
          instructorAssignments: {
            $push: {
              instructor: '$instructorEmail',
              totalFlights: '$totalFlights',
              completedFlights: '$completedFlights',
              totalHours: '$totalHours'
            }
          },
          uniqueInstructors: { $addToSet: '$instructorEmail' },
          totalStudentInstructorPairs: { $sum: 1 }
        }
      },
      {
        $project: {
          program: '$_id',
          avgInstructorsPerStudent: { $divide: [{ $size: '$uniqueInstructors' }, '$totalStudentInstructorPairs'] },
          instructorAssignments: 1,
          totalStudentInstructorPairs: 1
        }
      }
    ]);

    // **14. STUDENT ENGAGEMENT METRICS** (still using organization_id in database for now)
    const engagementMetrics = await Student.aggregate([
      { $match: { organization_id: organizationId, status: 'Active' } },
      {
        $lookup: {
          from: 'flightschedules',
          localField: '_id',
          foreignField: 'student_id',
          pipeline: [
            { $match: { created_at: { $gte: startDate } } },
            { $sort: { created_at: -1 } }
          ],
          as: 'recentFlights'
        }
      },
      {
        $project: {
          contact_email: 1,
          program: 1,
          enrollmentDate: 1,
          lastFlightDate: { $arrayElemAt: ['$recentFlights.actual_end_time', 0] },
          recentFlightCount: { $size: '$recentFlights' },
          daysSinceLastFlight: {
            $cond: [
              { $gt: [{ $size: '$recentFlights' }, 0] },
              { $divide: [{ $subtract: [new Date(), { $arrayElemAt: ['$recentFlights.actual_end_time', 0] }] }, 1000 * 60 * 60 * 24] },
              null
            ]
          }
        }
      },
      {
        $group: {
          _id: '$program',
          totalActiveStudents: { $sum: 1 },
          studentsWithRecentFlights: { $sum: { $cond: [{ $gt: ['$recentFlightCount', 0] }, 1, 0] } },
          avgDaysSinceLastFlight: { $avg: '$daysSinceLastFlight' },
          avgRecentFlights: { $avg: '$recentFlightCount' }
        }
      }
    ]);

    // Calculate derived metrics
    const completionRate = totalStudents > 0 ? (graduatedStudents / totalStudents) * 100 : 0;
    const retentionRate = totalStudents > 0 ? ((totalStudents - newEnrollments) / totalStudents) * 100 : 0;

    // Format the comprehensive response
    const stats = {
      overview: {
        total_students: totalStudents,
        active_students: activeStudents,
        new_enrollments_period: newEnrollments,
        graduated_students_period: graduatedStudents,
        completion_rate: Math.round(completionRate * 100) / 100,
        retention_rate: Math.round(retentionRate * 100) / 100
      },
      
      status_breakdown: statusBreakdown,
      
      program_breakdown: programBreakdown,
      enhanced_program_analysis: allPrograms,
      
      enrollment_trends: enrollmentTrends.map(trend => ({
        year: trend._id.year,
        month: trend._id.month,
        enrollments: trend.enrollments,
        active: trend.active
      })),
      
      flight_activity: {
        by_status: flightActivity,
        total_flights_period: flightActivity.reduce((sum, f) => sum + f.totalFlights, 0),
        completed_flights_period: flightActivity.reduce((sum, f) => sum + f.completedFlights, 0),
        total_hours_period: flightActivity.reduce((sum, f) => sum + f.totalHours, 0)
      },
      
      performance_metrics: {
        by_status: performanceMetrics,
        overall_on_time_rate: performanceMetrics.length > 0 
          ? performanceMetrics.reduce((sum, p) => sum + p.onTimeRate, 0) / performanceMetrics.length 
          : 0,
        avg_flights_per_student: flightActivity.length > 0 
          ? flightActivity.reduce((sum, f) => sum + f.avgFlightsPerStudent, 0) / flightActivity.length 
          : 0
      },
      
      enrollment_duration: enrollmentDuration,
      
      performance_trends: performanceTrends.map(trend => ({
        month: trend._id,
        total_flights: trend.totalFlights,
        total_on_time_flights: trend.totalOnTimeFlights,
        overall_on_time_rate: trend.totalFlights > 0 ? Math.round((trend.totalOnTimeFlights / trend.totalFlights) * 100 * 100) / 100 : 0,
        programs: trend.programs
      })),
      
      instructor_assignment_analysis: instructorAssignmentAnalysis.map(analysis => ({
        program: analysis.program,
        avg_instructors_per_student: Math.round(analysis.avgInstructorsPerStudent * 100) / 100,
        total_student_instructor_pairs: analysis.totalStudentInstructorPairs,
        instructor_assignments: analysis.instructorAssignments
      })),
      
      engagement_metrics: engagementMetrics.map(metric => ({
        program: metric._id,
        total_active_students: metric.totalActiveStudents,
        students_with_recent_flights: metric.studentsWithRecentFlights,
        engagement_rate: metric.totalActiveStudents > 0 ? Math.round((metric.studentsWithRecentFlights / metric.totalActiveStudents) * 100 * 100) / 100 : 0,
        avg_days_since_last_flight: Math.round(metric.avgDaysSinceLastFlight || 0),
        avg_recent_flights: Math.round(metric.avgRecentFlights * 100) / 100
      })),
      
      recent_activity: recentActivity.map(student => ({
        contact_email: student.contact_email,
        program: student.program,
        status: student.status,
        stage: student.stage,
        next_milestone: student.nextMilestone,
        enrollment_date: student.enrollmentDate,
        last_updated: student.updatedAt,
        last_flight_date: student.lastFlightDate
      })),
      
      ...(includeProgress && {
        progress_tracking: {
          by_program: progressStats,
          overall_progress: progressStats ? 
            progressStats.reduce((sum, p) => sum + p.averageProgress, 0) / progressStats.length : 0
        }
      }),
      
      ...(includeFinancials && {
        financial_metrics: financialStats
      }),
      
      certification_breakdown: certificationBreakdown[0]?.certificationCounts || {}
    };

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Student stats retrieved successfully',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      timeRange,
      includeFinancials,
      includeProgress,
      totalStudents,
      activeStudents,
      newEnrollments,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Student statistics retrieved successfully',
      data: {
        stats,
        metadata: {
          organization_id: params.organization,
          time_range_days: parseInt(timeRange),
          start_date: startDate.toISOString(),
          end_date: now.toISOString(),
          includes_financials: includeFinancials,
          includes_progress: includeProgress,
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
      message: 'Error retrieving student stats',
      auditId: securityContext.auditId,
      organizationId: params.organization,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, STUDENT_STATS_SECURITY_CONFIG); 