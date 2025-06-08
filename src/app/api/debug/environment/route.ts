import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Authenticate user and check for sys_admin role
    const auth = authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only allow sys_admin to view environment variables
    if ((auth as any).role !== 'sys_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only system administrators can access environment information' },
        { status: 403 }
      );
    }

    // Safe environment variables (no secrets)
    const safeEnvVars = {
      // Node.js environment
      NODE_ENV: process.env.NODE_ENV || 'not_set',
      
      // Application URLs
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'not_set',
      
      // Database configuration (safe parts only)
      MONGODB_URI: process.env.MONGODB_URI ? 'configured' : 'not_set',
      
      // Email configuration (safe parts only)
      EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'not_set',
      FROM_EMAIL: process.env.FROM_EMAIL || 'not_set',
      SMTP_HOST: process.env.SMTP_HOST || 'not_set',
      SMTP_PORT: process.env.SMTP_PORT || 'not_set',
      SMTP_SECURE: process.env.SMTP_SECURE || 'not_set',
      SMTP_USER: process.env.SMTP_USER ? 'configured' : 'not_set',
      SMTP_PASS: process.env.SMTP_PASS ? 'configured' : 'not_set',
      
      // JWT configuration (safe parts only)
      JWT_SECRET: process.env.JWT_SECRET ? 'configured' : 'not_set',
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || 'not_set',
      
      // API configuration
      API_VERSION: process.env.API_VERSION || 'not_set',
      
      // Rate limiting
      RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW || 'not_set',
      RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX || 'not_set',
      
      // Logging
      LOG_LEVEL: process.env.LOG_LEVEL || 'not_set',
      
      // Security
      CORS_ORIGIN: process.env.CORS_ORIGIN || 'not_set',
      
      // File upload
      MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || 'not_set',
      UPLOAD_PATH: process.env.UPLOAD_PATH || 'not_set',
      
      // External services
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY ? 'configured' : 'not_set',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_set',
      
      // Features
      FEATURE_MFA: process.env.FEATURE_MFA || 'not_set',
      FEATURE_MAGIC_LINKS: process.env.FEATURE_MAGIC_LINKS || 'not_set',
      
      // Debug/Development
      DEBUG: process.env.DEBUG || 'not_set',
      ALLOW_DEBUG_ENDPOINTS: process.env.ALLOW_DEBUG_ENDPOINTS || 'not_set'
    };

    // System information
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      cpus: require('os').cpus().length,
      loadAverage: require('os').loadavg(),
      freeMemory: Math.round(require('os').freemem() / 1024 / 1024),
      totalMemory: Math.round(require('os').totalmem() / 1024 / 1024)
    };

    // Configuration analysis
    const configStatus = {
      database: process.env.MONGODB_URI ? 'configured' : 'missing',
      email: (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ? 'configured' : 'incomplete',
      jwt: process.env.JWT_SECRET ? 'configured' : 'missing',
      stripe: (process.env.STRIPE_PUBLISHABLE_KEY && process.env.STRIPE_SECRET_KEY) ? 'configured' : 'incomplete',
      cors: process.env.CORS_ORIGIN ? 'configured' : 'using_defaults'
    };

    // Security recommendations
    const securityChecks = {
      nodeEnv: process.env.NODE_ENV === 'production' ? 'secure' : 'development_mode',
      jwtSecret: process.env.JWT_SECRET ? 'configured' : 'missing_secret',
      httpsOnly: process.env.NEXT_PUBLIC_APP_URL?.startsWith('https') ? 'secure' : 'insecure_http',
      debugEndpoints: process.env.ALLOW_DEBUG_ENDPOINTS === 'false' ? 'disabled' : 'enabled_warning'
    };

    console.log(JSON.stringify({
      type: 'environment_access',
      userId: (auth as any).userId,
      userRole: (auth as any).role,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      message: 'Environment configuration information',
      timestamp: new Date().toISOString(),
      environment: safeEnvVars,
      system: systemInfo,
      configurationStatus: configStatus,
      securityChecks: securityChecks,
      warnings: {
        sensitive: 'This endpoint only shows safe environment variables. Secrets and passwords are hidden.',
        access: 'This information is only available to system administrators.',
        production: process.env.NODE_ENV !== 'production' ? 'Running in development mode' : null
      }
    });

  } catch (error) {
    console.error('Environment debug endpoint error:', error);
    return NextResponse.json({
      message: 'Environment debug endpoint error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 