import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

interface HealthCheck {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
  database: {
    status: 'ok' | 'error';
    message?: string;
    connectionState: number;
    responseTime: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  system: {
    platform: string;
    nodeVersion: string;
    cpus: number;
  };
  api: {
    responseTime: number;
    status: 'ok' | 'error';
  };
}

// Debug endpoint configuration - public health check with minimal security
const DEBUG_CONFIG: SecurityConfig = {
  requireApiKey: true,
  enableFraudDetection: true,
  dataClassification: 'public',
  rateLimiting: { maxRequests: 100, windowMs: 60000 }
};

export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  const startTime = Date.now();
  const healthCheck: HealthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: 'ok',
      connectionState: 0,
      responseTime: 0
    },
    memory: {
      used: 0,
      total: 0,
      percentage: 0
    },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      cpus: require('os').cpus().length
    },
    api: {
      responseTime: 0,
      status: 'ok'
    }
  };

  try {
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Health check endpoint accessed',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    }));

    // Check database connection and performance
    const dbStartTime = Date.now();
    await connectDB();
    const db = mongoose.connection;
    healthCheck.database = {
      status: 'ok',
      connectionState: db.readyState,
      responseTime: Date.now() - dbStartTime
    };

    // Check memory usage
    const used = process.memoryUsage();
    healthCheck.memory = {
      used: Math.round(used.heapUsed / 1024 / 1024),
      total: Math.round(used.heapTotal / 1024 / 1024),
      percentage: Math.round((used.heapUsed / used.heapTotal) * 100)
    };

    // Check if memory usage is too high
    if (healthCheck.memory.percentage > 90) {
      healthCheck.status = 'error';
      healthCheck.database.status = 'error';
      healthCheck.database.message = 'High memory usage detected';
    }

    // Calculate API response time
    healthCheck.api.responseTime = Date.now() - startTime;

    // Log health check results
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Health check completed',
      auditId: securityContext.auditId,
      status: healthCheck.status,
      responseTime: healthCheck.api.responseTime,
      memoryUsage: healthCheck.memory.percentage,
      dbResponseTime: healthCheck.database.responseTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      auditId: securityContext.auditId,
      ...healthCheck
    });

  } catch (error) {
    healthCheck.status = 'error';
    healthCheck.database.status = 'error';
    healthCheck.database.message = error.message;
    healthCheck.api.status = 'error';

    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Health check failed',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      success: false,
      auditId: securityContext.auditId,
      ...healthCheck
    }, { status: 500 });
  }
}, DEBUG_CONFIG); 