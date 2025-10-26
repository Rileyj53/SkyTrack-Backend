import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, testSMTPConnection } from '@/lib/email';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';

// Debug endpoint configuration - requires authentication for email sending
const DEBUG_CONFIG: SecurityConfig = {
  requireAuth: true,
  requireApiKey: true,
  enableFraudDetection: true,
  enableAdvancedAudit: true,
  dataClassification: 'internal',
  rateLimiting: { maxRequests: 10, windowMs: 60000 }
};

// Configuration for GET endpoint (no auth required for config info)
const CONFIG_DEBUG_CONFIG: SecurityConfig = {
  requireApiKey: true,
  enableFraudDetection: true,
  dataClassification: 'public',
  rateLimiting: { maxRequests: 50, windowMs: 60000 }
};

export const POST = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Email debug endpoint accessed',
      auditId: securityContext.auditId,
      userId: securityContext.user?.userId,
      timestamp: new Date().toISOString()
    }));

    const { testEmail, to, subject, message } = await request.json();

    // Accept either 'testEmail' or 'to' for the recipient email
    const recipientEmail = testEmail || to;

    // Validate input
    if (!recipientEmail) {
      return NextResponse.json({
        success: false,
        error: 'Recipient email is required',
        auditId: securityContext.auditId,
        acceptedFields: ['testEmail', 'to'],
        example: { to: 'user@example.com', subject: 'Test', message: 'Hello' },
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email format',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const testSubject = subject || 'SkyTrack API Email Test';
    const testMessage = message || `
      <h2>Email Service Test</h2>
      <p>This is a test email from the SkyTrack API debug endpoint.</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      <p><strong>Test ID:</strong> ${Math.random().toString(36).substring(7)}</p>
      <p><strong>Sent by User:</strong> ${securityContext.user?.userId}</p>
      <p><strong>Audit ID:</strong> ${securityContext.auditId}</p>
      <p>If you received this email, the email service is working correctly.</p>
      <hr>
      <p><small>This email was sent from the debug endpoint for testing purposes.</small></p>
    `;

    const startTime = Date.now();

    try {
      const emailSuccess = await sendEmail(recipientEmail, testSubject, testMessage);
      const responseTime = Date.now() - startTime;

      console.log(JSON.stringify({
        level: 'INFO',
        message: 'Test email sent successfully',
        auditId: securityContext.auditId,
        recipient: recipientEmail,
        subject: testSubject,
        responseTime,
        success: emailSuccess,
        userId: securityContext.user?.userId,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: true,
        message: emailSuccess ? 'Test email sent successfully' : 'Email test completed (development mode)',
        recipient: recipientEmail,
        subject: testSubject,
        responseTime,
        emailSent: emailSuccess,
        sentBy: securityContext.user?.userId,
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        debugInfo: {
          emailLength: testMessage.length,
          emailProvider: process.env.EMAIL_PROVIDER || 'default',
          fromAddress: process.env.SMTP_FROM || 'not_configured',
          testId: Math.random().toString(36).substring(7),
          developmentMode: !emailSuccess,
          authMethod: 'API Key + JWT Token'
        }
      });

    } catch (emailError) {
      const responseTime = Date.now() - startTime;
      
      console.error(JSON.stringify({
        level: 'ERROR',
        message: 'Email test failed',
        auditId: securityContext.auditId,
        recipient: recipientEmail,
        error: emailError.message,
        responseTime,
        userId: securityContext.user?.userId,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        success: false,
        message: 'Email test failed',
        error: emailError.message,
        recipient: recipientEmail,
        responseTime,
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString(),
        debugInfo: {
          emailProvider: process.env.EMAIL_PROVIDER || 'default',
          fromAddress: process.env.SMTP_FROM || 'not_configured',
          smtpHost: process.env.SMTP_HOST || 'not_configured',
          smtpPort: process.env.SMTP_PORT || 'not_configured'
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Email test endpoint error',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, DEBUG_CONFIG);

export const GET = secureApiRoute(async (request: NextRequest, { securityContext }) => {
  try {
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Email configuration debug accessed',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString()
    }));

    // Test SMTP connection
    const connectionTest = await testSMTPConnection();

    // Return email configuration info (safe values only)
    return NextResponse.json({
      success: true,
      message: 'Email service configuration',
      auditId: securityContext.auditId,
      timestamp: new Date().toISOString(),
      configuration: connectionTest.config,
      connection: {
        status: connectionTest.connected ? 'connected' : 'failed',
        error: connectionTest.error || null,
        lastTested: new Date().toISOString()
      },
      usage: {
        endpoint: 'POST /api/debug/email',
        requiredFields: ['testEmail OR to'],
        optionalFields: ['subject', 'message'],
        authentication: 'API Key + JWT Token required (email sending needs user auth)',
        purpose: 'Test email delivery functionality',
        securityNote: 'Requires user authentication due to potential for abuse',
        examples: [
          { testEmail: 'user@example.com', subject: 'Test', message: 'Hello' },
          { to: 'user@example.com', subject: 'Test', message: 'Hello' }
        ]
      },
      troubleshooting: connectionTest.connected ? null : {
        commonIssues: [
          'Check SMTP_HOST, SMTP_PORT settings',
          'Verify SMTP_USER and SMTP_PASS credentials',
          'Check if less secure app access is enabled (Gmail)',
          'Verify firewall/network connectivity to SMTP server',
          'Check if 2FA requires app-specific password'
        ],
        configRequired: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
      }
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Email config endpoint error',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error;
  }
}, CONFIG_DEBUG_CONFIG); 