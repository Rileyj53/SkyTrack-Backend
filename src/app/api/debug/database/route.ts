import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User, School, Student, Instructor, FlightSchedule } from '@/models';
import mongoose from 'mongoose';
import { validateApiKey } from '@/middleware/apiKeyAuth';

export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

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
        const count = await collection.model.countDocuments();
        const sampleDoc = await collection.model.findOne().lean();
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
      const userCount = await User.countDocuments({ isActive: true });
      
      // Test aggregation
      const usersByRole = await User.aggregate([
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

    return NextResponse.json({
      message: 'Database connectivity and operations test',
      timestamp: new Date().toISOString(),
      totalResponseTime: Date.now() - startTime,
      ...tests
    });

  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({
      message: 'Database test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 