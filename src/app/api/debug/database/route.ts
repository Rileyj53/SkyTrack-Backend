import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User, School, Student, Instructor, FlightSchedule } from '@/models';
import mongoose from 'mongoose';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Debug endpoint configuration - requires API key
const DEBUG_CONFIG: SecurityConfig = {
  requireApiKey: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'internal',
  rateLimiting: { maxRequests: 20, windowMs: 60000 }
};

export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Database debug endpoint accessed',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    }));

    const startTime = Date.now();
    await connectDB();
    
    const db = mongoose.connection;
    const dbConnectTime = Date.now() - startTime;

    // Test basic database operations
    const tests = {
      connection: {
        status: 'ok',
        responseTime: dbConnectTime,
        state: db.readyState,
        stateName: ['disconnected', 'connected', 'connecting', 'disconnecting'][db.readyState] || 'unknown'
      },
      collections: {},
      operations: {},
      indexes: {},
      stats: {}
    };

    // Test collection access and counts
    const collections = [
      { name: 'users', model: User },
      { name: 'schools', model: School },
      { name: 'students', model: Student },
      { name: 'instructors', model: Instructor },
      { name: 'flightschedules', model: FlightSchedule }
    ];

    for (const collection of collections) {
      const collectionStartTime = Date.now();
      try {
        const count = await (collection.model as any).countDocuments();
        const sampleDoc = await (collection.model as any).findOne().lean();
        tests.collections[collection.name] = {
          status: 'ok',
          count,
          responseTime: Date.now() - collectionStartTime,
          hasSampleDoc: !!sampleDoc,
          sampleFields: sampleDoc ? Object.keys(sampleDoc).length : 0
        };
      } catch (error) {
        tests.collections[collection.name] = {
          status: 'error',
          error: error.message,
          responseTime: Date.now() - collectionStartTime
        };
      }
    }

    // Test CRUD operations (safe operations only)
    const opStartTime = Date.now();
    try {
      // Test read operation
      const userCount = await (User as any).countDocuments({ isActive: true });
      
      // Test aggregation
      const usersByRole = await (User as any).aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]);

      tests.operations = {
        status: 'ok',
        responseTime: Date.now() - opStartTime,
        activeUsers: userCount,
        usersByRole: usersByRole.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      };
    } catch (error) {
      tests.operations = {
        status: 'error',
        error: error.message,
        responseTime: Date.now() - opStartTime
      };
    }

    // Test database statistics
    try {
      const admin = db.db.admin();
      const serverStatus = await admin.serverStatus();
      tests.stats = {
        version: serverStatus.version,
        uptime: serverStatus.uptime,
        connections: serverStatus.connections,
        opcounters: serverStatus.opcounters,
        memory: serverStatus.mem
      };
    } catch (error) {
      tests.stats = {
        status: 'error',
        error: 'Unable to get server stats (may require admin privileges)'
      };
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Database connectivity test completed',
      auditId: securityContext.auditId,
      totalResponseTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Database connectivity and operations test',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      totalResponseTime: Date.now() - startTime,
      ...tests
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Database test failed',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, DEBUG_CONFIG); 