import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { hashPassword, validatePassword } from '@/lib/auth';

// Password validation with detailed feedback
function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for sequential patterns
  const sequences = ['123', 'abc', 'qwe', '456', 'def', 'ert', '789', 'ghi', 'rty'];
  const lowerPassword = password.toLowerCase();
  
  for (const seq of sequences) {
    if (lowerPassword.includes(seq) || lowerPassword.includes(seq.split('').reverse().join(''))) {
      errors.push('Password must not contain sequential patterns');
      break;
    }
  }
  
  // Check for character repetition
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password must not contain more than 2 consecutive identical characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Security configuration for password reset completion endpoint
const SECURITY_CONFIG: SecurityConfig = {
  requireAuth: false, // Not required for password reset completion
  requireApiKey: true, // API key required to prevent abuse
  requireCSRF: false, // Not required for password reset completion
  enableFraudDetection: true, // Critical to prevent abuse
  enableAdvancedAudit: true, // Track all password reset completions
  dataClassification: 'restricted', // Contains passwords and tokens
  rateLimiting: {
    maxRequests: 5, // Strict rate limiting for password reset attempts
    windowMs: 300000, // 5 minute window
    slidingWindow: true
  },
  maxRequestSize: 1024 * 4 // 4KB max for reset completion
};

export const POST = secureApiRoute(async (request, { params, securityContext }) => {
  const startTime = Date.now();
  
  // Structured logging for Vercel
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Password reset completion initiated',
    auditId: securityContext.auditId,
    riskScore: securityContext.riskScore,
    timestamp: new Date().toISOString(),
    endpoint: 'POST /api/auth/reset-password/complete'
  }));

  // Check risk score - block high-risk password reset attempts
  if (securityContext.riskScore > 75) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'High risk password reset completion blocked',
      auditId: securityContext.auditId,
      riskScore: securityContext.riskScore,
      fraudFlags: securityContext.fraudFlags,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Password reset blocked due to security policy',
        code: 'HIGH_RISK_RESET_COMPLETION',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      },
      securityContext: {
        riskScore: securityContext.riskScore,
        fraudFlags: securityContext.fraudFlags
      }
    }, { status: 403 });
  }

  // Establish database connection with retry logic
  await connectDB();

  const body = await request.json();
  const { token, password, newPassword } = body;

  // Use either password or newPassword field for flexibility
  const resetPassword = password || newPassword;

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Processing password reset completion',
    auditId: securityContext.auditId,
    hasToken: !!token,
    hasPassword: !!resetPassword,
    timestamp: new Date().toISOString()
  }));

  // Validate input
  if (!token || !resetPassword) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Password reset completion with missing required fields',
      auditId: securityContext.auditId,
      hasToken: !!token,
      hasPassword: !!resetPassword,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Token and new password are required',
        code: 'MISSING_REQUIRED_FIELDS',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Validate password strength with detailed feedback
  const passwordValidation = validatePasswordStrength(resetPassword);
  if (!passwordValidation.isValid) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message: 'Password reset completion with weak password',
      auditId: securityContext.auditId,
      passwordErrors: passwordValidation.errors,
      timestamp: new Date().toISOString()
    }));
    
    return NextResponse.json({
      error: {
        message: 'Password does not meet security requirements',
        code: 'WEAK_PASSWORD',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        details: {
          requirements: passwordValidation.errors
        }
      }
    }, { status: 400 });
  }

  try {
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Looking up user with reset token',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    }));

    // Find user with this reset token
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiration: { $gt: Date.now() }
    });
    
    if (!user) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Password reset completion with invalid or expired token',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Invalid or expired reset token',
          code: 'INVALID_RESET_TOKEN',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Valid reset token found, updating password',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      timestamp: new Date().toISOString()
    }));

    // Get client IP and user agent for enhanced audit
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Hash the new password with enhanced security
    const hashedPassword = await hashPassword(resetPassword);
    
    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiration = null;
    
    // Track password change with enhanced audit data
    await user.trackPasswordChange(ipAddress, userAgent);
    
    // Save the user
    await user.save();

    const processingTime = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Password reset completed successfully',
      auditId: securityContext.auditId,
      userId: user._id.toString(),
      email: user.email,
      processingTime,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      securityContext: {
        sessionId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        encryptionLevel: 'AES-256'
      }
    });

  } catch (dbError) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Database error during password reset completion',
      auditId: securityContext.auditId,
      error: dbError.message,
      timestamp: new Date().toISOString()
    }));

    return NextResponse.json({
      error: {
        message: 'Error processing password reset',
        code: 'DATABASE_ERROR',
        requestId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}, SECURITY_CONFIG); 