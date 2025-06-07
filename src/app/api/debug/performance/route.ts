import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const startTime = Date.now();
    const tests = {
      apiKey: {
        responseTime: Date.now() - startTime,
        status: 'completed'
      },
      database: {},
      memory: {},
      cpu: {},
      network: {},
      overall: {}
    };

    // Database performance test
    const dbStartTime = Date.now();
    try {
      await connectDB();
      
      // Simple query test
      const simpleQueryStart = Date.now();
      await User.findOne().lean();
      const simpleQueryTime = Date.now() - simpleQueryStart;
      
      // Count query test
      const countQueryStart = Date.now();
      const userCount = await User.countDocuments();
      const countQueryTime = Date.now() - countQueryStart;
      
      // Aggregation test
      const aggregationStart = Date.now();
      await User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]);
      const aggregationTime = Date.now() - aggregationStart;
      
      tests.database = {
        status: 'completed',
        totalTime: Date.now() - dbStartTime,
        operations: {
          simpleQuery: simpleQueryTime,
          countQuery: countQueryTime,
          aggregation: aggregationTime
        },
        recordCount: userCount,
        performance: {
          simple: simpleQueryTime < 50 ? 'excellent' : simpleQueryTime < 100 ? 'good' : 'slow',
          count: countQueryTime < 100 ? 'excellent' : countQueryTime < 200 ? 'good' : 'slow',
          aggregation: aggregationTime < 200 ? 'excellent' : aggregationTime < 500 ? 'good' : 'slow'
        }
      };
    } catch (dbError) {
      tests.database = {
        status: 'error',
        error: dbError.message,
        responseTime: Date.now() - dbStartTime
      };
    }

    // Memory performance test
    const memoryStart = Date.now();
    const memoryUsage = process.memoryUsage();
    tests.memory = {
      status: 'completed',
      responseTime: Date.now() - memoryStart,
      usage: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      },
      percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      performance: memoryUsage.heapUsed < (100 * 1024 * 1024) ? 'excellent' : 
                  memoryUsage.heapUsed < (200 * 1024 * 1024) ? 'good' : 'high'
    };

    // CPU performance test (simple computation)
    const cpuStart = Date.now();
    let result = 0;
    for (let i = 0; i < 100000; i++) {
      result += Math.sqrt(i);
    }
    tests.cpu = {
      status: 'completed',
      responseTime: Date.now() - cpuStart,
      iterations: 100000,
      result: Math.round(result),
      performance: (Date.now() - cpuStart) < 10 ? 'excellent' : 
                  (Date.now() - cpuStart) < 50 ? 'good' : 'slow'
    };

    // Network/Response test
    const networkStart = Date.now();
    const responseSize = JSON.stringify(tests).length;
    tests.network = {
      status: 'completed',
      responseTime: Date.now() - networkStart,
      responseSize: responseSize,
      estimatedTransferTime: Math.round(responseSize / 1000), // rough estimate in ms for 1MB/s
      performance: responseSize < 10000 ? 'excellent' : 
                  responseSize < 50000 ? 'good' : 'large'
    };

    // Overall performance summary
    const totalTime = Date.now() - startTime;
    tests.overall = {
      totalResponseTime: totalTime,
      timestamp: new Date().toISOString(),
      performance: totalTime < 100 ? 'excellent' : 
                  totalTime < 500 ? 'good' : 
                  totalTime < 1000 ? 'acceptable' : 'slow',
      recommendations: []
    };

    // Generate performance recommendations
    if (tests.database.totalTime > 200) {
      tests.overall.recommendations.push('Consider database query optimization');
    }
    if (tests.memory.percentage > 80) {
      tests.overall.recommendations.push('Memory usage is high, consider optimization');
    }
    if (tests.cpu.responseTime > 50) {
      tests.overall.recommendations.push('CPU performance may be impacted by system load');
    }
    if (totalTime > 500) {
      tests.overall.recommendations.push('Overall response time is slow, investigate bottlenecks');
    }
    if (tests.overall.recommendations.length === 0) {
      tests.overall.recommendations.push('Performance is within acceptable ranges');
    }

    return NextResponse.json({
      message: 'Performance benchmark completed',
      ...tests
    });

  } catch (error) {
    console.error('Performance benchmark error:', error);
    return NextResponse.json({
      message: 'Performance benchmark failed',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { iterations = 1, includeDatabase = true, includeComputation = true } = await request.json();

    if (iterations < 1 || iterations > 10) {
      return NextResponse.json(
        { error: 'Iterations must be between 1 and 10' },
        { status: 400 }
      );
    }

    const results = [];
    const overallStart = Date.now();

    for (let i = 0; i < iterations; i++) {
      const iterationStart = Date.now();
      const iterationResult = {
        iteration: i + 1,
        database: null,
        computation: null,
        memory: null,
        responseTime: 0
      };

      // Database test
      if (includeDatabase) {
        const dbStart = Date.now();
        try {
          await connectDB();
          await User.findOne().lean();
          iterationResult.database = Date.now() - dbStart;
        } catch (error) {
          iterationResult.database = `error: ${error.message}`;
        }
      }

      // Computation test
      if (includeComputation) {
        const computeStart = Date.now();
        let sum = 0;
        for (let j = 0; j < 10000; j++) {
          sum += Math.sqrt(j * Math.random());
        }
        iterationResult.computation = Date.now() - computeStart;
      }

      // Memory snapshot
      const memUsage = process.memoryUsage();
      iterationResult.memory = Math.round(memUsage.heapUsed / 1024 / 1024);
      iterationResult.responseTime = Date.now() - iterationStart;

      results.push(iterationResult);
    }

    const totalTime = Date.now() - overallStart;

    // Calculate statistics
    const dbTimes = results.filter(r => typeof r.database === 'number').map(r => r.database);
    const computeTimes = results.filter(r => typeof r.computation === 'number').map(r => r.computation);
    const responseTimes = results.map(r => r.responseTime);

    const statistics = {
      database: dbTimes.length > 0 ? {
        min: Math.min(...dbTimes),
        max: Math.max(...dbTimes),
        avg: Math.round(dbTimes.reduce((a, b) => a + b, 0) / dbTimes.length),
        count: dbTimes.length
      } : null,
      computation: computeTimes.length > 0 ? {
        min: Math.min(...computeTimes),
        max: Math.max(...computeTimes),
        avg: Math.round(computeTimes.reduce((a, b) => a + b, 0) / computeTimes.length),
        count: computeTimes.length
      } : null,
      response: {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        avg: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
        total: totalTime
      }
    };

    return NextResponse.json({
      message: 'Performance stress test completed',
      iterations,
      results,
      statistics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Performance stress test error:', error);
    return NextResponse.json({
      message: 'Performance stress test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 