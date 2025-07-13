import { NextRequest, NextResponse } from 'next/server';
import { checkDBHealth, getConnectionStatus } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Get current connection status
    const status = getConnectionStatus();
    
    // Perform health check
    const isHealthy = await checkDBHealth();
    
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      database: {
        connected: isHealthy,
        state: status.state,
        readyState: status.readyState,
        attempts: status.attempts,
        lastError: status.lastError,
        responseTime: `${responseTime}ms`
      },
      timestamp: new Date().toISOString()
    }, { 
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      database: {
        connected: false,
        error: error.message
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 