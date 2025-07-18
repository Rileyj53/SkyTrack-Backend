import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecurityConfig } from '@/middleware/security';
import { connectDB } from '@/lib/db';
import { WaitlistEntry } from '@/models/WaitlistEntry';
import { Errors } from '@/lib/errors';
import { sendEmail } from '@/lib/email';

// Public security configuration for waitlist signup - minimal security required
const WAITLIST_CONFIG: SecurityConfig = {
  requireApiKey: true,
  enableFraudDetection: true,
  dataClassification: 'public',
  rateLimiting: {
    maxRequests: 50, // Allow more requests for public signup
    windowMs: 60000,
    slidingWindow: true
  }
};

// POST /api/waitlist - Join the waitlist with email
export const POST = secureApiRoute(async (request, { securityContext }) => {
  const startTime = Date.now();
  
  try {
    // Establish database connection with automatic retry logic
    await connectDB();
    
    // Structured logging for Vercel
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Processing waitlist signup request',
      auditId: securityContext.auditId,
      riskScore: securityContext.riskScore,
      timestamp: new Date().toISOString(),
      endpoint: '/api/waitlist'
    }));

    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.email) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Email not provided in waitlist signup',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Email is required',
          code: 'EMAIL_REQUIRED',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(body.email.trim())) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'Invalid email format provided',
        auditId: securityContext.auditId,
        email: body.email.substring(0, 3) + '***', // Partial email for logging
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Please enter a valid email address',
          code: 'INVALID_EMAIL_FORMAT',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Block high-risk requests
    if (securityContext.riskScore > 85) {
      console.warn(JSON.stringify({
        level: 'WARN',
        message: 'High risk waitlist signup blocked',
        auditId: securityContext.auditId,
        riskScore: securityContext.riskScore,
        fraudFlags: securityContext.fraudFlags,
        timestamp: new Date().toISOString()
      }));
      
      return NextResponse.json({
        error: {
          message: 'Request blocked due to security policy',
          code: 'HIGH_RISK_BLOCKED',
          requestId: securityContext.auditId,
          timestamp: new Date().toISOString()
        },
        securityContext: {
          riskScore: securityContext.riskScore,
          fraudFlags: securityContext.fraudFlags
        }
      }, { status: 403 });
    }

    // Extract additional tracking information
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Prepare waitlist entry data
    const waitlistData = {
      email: body.email.trim().toLowerCase(),
      submittedAt: new Date(),
      ipAddress: ipAddress,
      userAgent: userAgent,
      source: body.source || 'waitlist_form',
      status: 'active' as const
    };

    try {
      // Try to create the waitlist entry
      const waitlistEntry = new WaitlistEntry(waitlistData);
      await waitlistEntry.save();

      const processingTime = Date.now() - startTime;

      console.log(JSON.stringify({
        level: 'INFO',
        message: 'Waitlist signup completed successfully',
        auditId: securityContext.auditId,
        email: waitlistData.email.substring(0, 3) + '***', // Partial email for logging
        source: waitlistData.source,
        processingTime: processingTime,
        timestamp: new Date().toISOString()
      }));

      // Send confirmation email (non-blocking)
      try {
        const emailSubject = 'Welcome to the SkyTrack Waitlist! 🛩️';
        const emailHtml = `
          <!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Albatross</title>
</head>
<body style="margin: 0; padding: 0; background-color: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;">
  
  <!-- Main Container Table -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
    <tr>
      <td align="center">
        <table width="800" cellpadding="0" cellspacing="0" border="0" style="max-width: 800px; background-color: #000000;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 60px 40px 40px 40px; text-align: center; background-color: #000000;">
              <div style="font-size: 48px; font-weight: 800; color: #ffffff; margin-bottom: 20px; letter-spacing: -0.02em;">✈️ Albatross</div>
              <h1 style="font-size: 36px; font-weight: 700; color: #ffffff; margin: 0 0 16px 0; letter-spacing: -0.02em;">Welcome to the Waitlist!</h1>
              <p style="font-size: 20px; color: #a1a1aa; margin: 0; font-weight: 400;">Your entire flight school. One seamless platform.</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px; background-color: #000000;">
              
              <!-- Intro Text -->
              <p style="font-size: 18px; color: #e4e4e7; text-align: center; margin-bottom: 50px; line-height: 1.7;">
                Thank you for joining the <span style="color: #3b82f6; font-weight: 600;">Albatross</span> waitlist! You're now among the first to know when we launch the next generation of flight school management.
              </p>
              
              <!-- Ready for Takeoff Section -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 40px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #1e1e2e 0%, #252545 100%); border: 1px solid #3f3f46; border-radius: 16px; padding: 40px; text-align: center;">
                    <h3 style="font-size: 24px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0;">🚀 Ready for Takeoff</h3>
                    <p style="font-size: 16px; color: #a1a1aa; margin: 0;">
                      We're building something extraordinary. You'll receive early access, exclusive updates, and special launch offers as we prepare for takeoff.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Features Section Title -->
              <h2 style="font-size: 28px; font-weight: 700; color: #ffffff; text-align: center; margin: 60px 0 40px 0; letter-spacing: -0.02em;">Built for the Future of Aviation Training</h2>
              
              <!-- Feature 1: Live Flight Tracking -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1a1a1a; border: 1px solid #333333; border-radius: 16px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="92" style="vertical-align: top; padding-right: 28px;">
                          <table width="64" height="64" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%); border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);">
                            <tr>
                              <td style="text-align: center; vertical-align: middle; font-size: 26px; color: #ffffff; font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;">📍</td>
                            </tr>
                          </table>
                        </td>
                        <td style="vertical-align: top;">
                          <h4 style="font-size: 20px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">Live Flight Tracking</h4>
                          <p style="font-size: 15px; color: #a1a1aa; margin: 0; line-height: 1.6;">
                            See every aircraft in the sky in real time to monitor student flights with confidence and precision
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Feature 2: Student Progress Tracking -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1a1a1a; border: 1px solid #333333; border-radius: 16px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="92" style="vertical-align: top; padding-right: 28px;">
                          <table width="64" height="64" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #10b981 0%, #22c55e 100%); border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);">
                            <tr>
                              <td style="text-align: center; vertical-align: middle; font-size: 26px; color: #ffffff; font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;">🎓</td>
                            </tr>
                          </table>
                        </td>
                        <td style="vertical-align: top;">
                          <h4 style="font-size: 20px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">Student Progress Tracking</h4>
                          <p style="font-size: 15px; color: #a1a1aa; margin: 0; line-height: 1.6;">
                            Monitor training milestones, flight hours, and performance in real time while AI keeps students on track with optimized schedules and insights
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Feature 3: Real-Time Analytics -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1a1a1a; border: 1px solid #333333; border-radius: 16px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="92" style="vertical-align: top; padding-right: 28px;">
                          <table width="64" height="64" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);">
                            <tr>
                              <td style="text-align: center; vertical-align: middle; font-size: 26px; color: #ffffff; font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;">📊</td>
                            </tr>
                          </table>
                        </td>
                        <td style="vertical-align: top;">
                          <h4 style="font-size: 20px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">Real-Time Analytics</h4>
                          <p style="font-size: 15px; color: #a1a1aa; margin: 0; line-height: 1.6;">
                            Monitor key metrics across your school and unlock AI-powered insights to improve scheduling, training, and operational efficiency
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Feature 4: Financial Management -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1a1a1a; border: 1px solid #333333; border-radius: 16px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="92" style="vertical-align: top; padding-right: 28px;">
                          <table width="64" height="64" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);">
                            <tr>
                              <td style="text-align: center; vertical-align: middle; font-size: 26px; color: #ffffff; font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;">💳</td>
                            </tr>
                          </table>
                        </td>
                        <td style="vertical-align: top;">
                          <h4 style="font-size: 20px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">Financial Management</h4>
                          <p style="font-size: 15px; color: #a1a1aa; margin: 0; line-height: 1.6;">
                            Track student costs and school revenue with flexible billing options and a centralized view of your finances
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Feature 5: Dashboard -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1a1a1a; border: 1px solid #333333; border-radius: 16px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="92" style="vertical-align: top; padding-right: 28px;">
                          <table width="64" height="64" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f43f5e 0%, #ef4444 100%); border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);">
                            <tr>
                              <td style="text-align: center; vertical-align: middle; font-size: 26px; color: #ffffff; font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;">🎯</td>
                            </tr>
                          </table>
                        </td>
                        <td style="vertical-align: top;">
                          <h4 style="font-size: 20px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">Dashboard</h4>
                          <p style="font-size: 15px; color: #a1a1aa; margin: 0; line-height: 1.6;">
                            Stay in control with a real-time overview of flights, students, and aircraft to make faster, smarter decisions
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Section -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 50px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #1e1e2e 0%, #252545 100%); border: 1px solid #3f3f46; border-radius: 16px; padding: 40px; text-align: center;">
                    <h3 style="font-size: 22px; font-weight: 600; color: #ffffff; margin: 0 0 16px 0;">What happens next?</h3>
                    <p style="font-size: 16px; color: #a1a1aa; margin: 0; line-height: 1.6;">
                      We're working hard to simplify daily operations, enhance training, and scale with confidence using tools built for the future of aviation. Stay tuned for exclusive previews and behind-the-scenes updates!
                    </p>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 40px; background-color: #000000; border-top: 1px solid #27272a; color: #71717a; font-size: 14px;">
              <p style="margin: 8px 0;">This email was sent to <span style="color: #ffffff; font-weight: 600;">${waitlistData.email}</span></p>
              
              <p style="margin: 20px 0 8px 0;">
                <strong style="color: #ffffff;">Albatross Flight School Management</strong><br>
                <span style="color: #3b82f6;">Building the future of aviation training</span>
              </p>
              
              <p style="font-size: 12px; color: #52525b; margin: 20px 0 0 0;">
                If you didn't sign up for this waitlist, please disregard this email.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
  
</body>
</html>
        `;

        const emailSent = await sendEmail(waitlistData.email, emailSubject, emailHtml);
        
        console.log(JSON.stringify({
          level: 'INFO',
          message: 'Waitlist confirmation email processed',
          auditId: securityContext.auditId,
          email: waitlistData.email.substring(0, 3) + '***',
          emailSent: emailSent,
          timestamp: new Date().toISOString()
        }));

      } catch (emailError: any) {
        // Log email error but don't fail the request
        console.warn(JSON.stringify({
          level: 'WARN',
          message: 'Waitlist confirmation email failed',
          auditId: securityContext.auditId,
          email: waitlistData.email.substring(0, 3) + '***',
          error: emailError.message,
          timestamp: new Date().toISOString()
        }));
      }

      return NextResponse.json({
        success: true,
        message: 'Successfully joined the waitlist! We\'ll be in touch soon.',
        auditId: securityContext.auditId,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      // Handle duplicate email case
      if (error.code === 11000 && error.keyPattern?.email) {
        console.log(JSON.stringify({
          level: 'INFO',
          message: 'Duplicate email attempted waitlist signup',
          auditId: securityContext.auditId,
          email: waitlistData.email.substring(0, 3) + '***',
          timestamp: new Date().toISOString()
        }));

        // Return success message even for duplicates for security
        return NextResponse.json({
          success: true,
          message: 'Successfully joined the waitlist! We\'ll be in touch soon.',
          auditId: securityContext.auditId,
          timestamp: new Date().toISOString()
        });
      }

      // Handle other database errors
      console.error(JSON.stringify({
        level: 'ERROR',
        message: 'Database error during waitlist signup',
        auditId: securityContext.auditId,
        error: error.message,
        timestamp: new Date().toISOString()
      }));

      throw Errors.InternalServerError('Failed to save waitlist entry', error);
    }

  } catch (error: any) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Waitlist signup failed',
      auditId: securityContext.auditId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));

    throw error; // Let the global errorHandler process it
  }
}, WAITLIST_CONFIG); 