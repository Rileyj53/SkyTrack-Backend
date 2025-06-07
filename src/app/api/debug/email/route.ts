import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, testSMTPConnection } from '@/lib/email';
import { validateApiKey } from '@/middleware/apiKeyAuth';
import { authenticateRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Authenticate user (required for email sending)
    const auth = authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { 
          error: 'User authentication required',
          message: 'Email sending requires both API key and valid JWT token for security',
          authError: auth.message,
          troubleshooting: {
            checkAuthHeader: 'Ensure Authorization: Bearer <token> header is present',
            checkCookies: 'Or ensure you are logged in and token cookie is set',
            tokenSources: 'Accepts tokens from Authorization header or cookies'
          }
        },
        { status: 401 }
      );
    }

    const { testEmail, to, subject, message } = await request.json();

    // Accept either 'testEmail' or 'to' for the recipient email
    const recipientEmail = testEmail || to;

    // Validate input
    if (!recipientEmail) {
      return NextResponse.json(
        { 
          error: 'Recipient email is required',
          acceptedFields: ['testEmail', 'to'],
          example: { to: 'user@example.com', subject: 'Test', message: 'Hello' }
        },
        { status: 400 }
      );
    }

    // Email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const testSubject = subject || 'SkyTrack API Email Test';
    const testMessage = message || `
      <h2>Email Service Test</h2>
      <p>This is a test email from the SkyTrack API debug endpoint.</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      <p><strong>Test ID:</strong> ${Math.random().toString(36).substring(7)}</p>
      <p><strong>Sent by User:</strong> ${auth.userId}</p>
      <p>If you received this email, the email service is working correctly.</p>
      <hr>
      <p><small>This email was sent from the debug endpoint for testing purposes.</small></p>
    `;

    const startTime = Date.now();

    try {
      const emailSuccess = await sendEmail(recipientEmail, testSubject, testMessage);
      const responseTime = Date.now() - startTime;

      console.log(JSON.stringify({
        type: 'email_test_success',
        recipient: recipientEmail,
        subject: testSubject,
        responseTime,
        success: emailSuccess,
        userId: auth.userId,
        tokenSource: auth.tokenSource,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        message: emailSuccess ? 'Test email sent successfully' : 'Email test completed (development mode)',
        recipient: recipientEmail,
        subject: testSubject,
        responseTime,
        success: emailSuccess,
        sentBy: auth.userId,
        timestamp: new Date().toISOString(),
        debugInfo: {
          emailLength: testMessage.length,
          emailProvider: process.env.EMAIL_PROVIDER || 'default',
          fromAddress: process.env.SMTP_FROM || 'not_configured',
          testId: Math.random().toString(36).substring(7),
          developmentMode: !emailSuccess,
          authMethod: 'API Key + JWT Token',
          tokenSource: auth.tokenSource
        }
      });

    } catch (emailError) {
      const responseTime = Date.now() - startTime;
      
      console.error(JSON.stringify({
        type: 'email_test_error',
        recipient: recipientEmail,
        error: emailError.message,
        responseTime,
        userId: auth.userId,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json({
        message: 'Email test failed',
        error: emailError.message,
        recipient: recipientEmail,
        responseTime,
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
    console.error('Email test endpoint error:', error);
    return NextResponse.json({
      message: 'Email test endpoint error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const authResult = await validateApiKey(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Test SMTP connection
    const connectionTest = await testSMTPConnection();

    // Return email configuration info (safe values only)
    return NextResponse.json({
      message: 'Email service configuration',
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
    console.error('Email config endpoint error:', error);
    return NextResponse.json({
      message: 'Email configuration check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 