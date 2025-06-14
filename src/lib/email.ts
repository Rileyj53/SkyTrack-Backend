// Simple email configuration without complex imports
let emailConfig: any = null;
let initializationError: string | null = null;

async function getEmailTransporter() {
  if (emailConfig) {
    return emailConfig;
  }

  try {
    // Direct require at function level to avoid webpack bundling issues
    const nodemailer = eval('require')('nodemailer');
    
    const smtpSettings = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    console.log('Email SMTP Config:', {
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.secure,
      user: smtpSettings.auth.user ? 'configured' : 'missing',
      pass: smtpSettings.auth.pass ? 'configured' : 'missing'
    });

    emailConfig = nodemailer.createTransporter ? 
      nodemailer.createTransporter(smtpSettings) : 
      nodemailer.createTransport(smtpSettings);
    
    // Test connection
    console.log('Testing SMTP connection...');
    const verified = await emailConfig.verify();
    console.log('SMTP verification result:', verified);
    
    if (!verified) {
      throw new Error('SMTP connection verification failed');
    }
    
    console.log('SMTP connection successful');
    initializationError = null;
    return emailConfig;
    
  } catch (error) {
    console.error('SMTP connection failed:', error.message);
    initializationError = error.message;
    
    // Return mock transporter
    emailConfig = {
      sendMail: async (options: any) => {
        console.log('📧 MOCK EMAIL - Would have sent:');
        console.log('  To:', options.to);
        console.log('  Subject:', options.subject);
        console.log('  Error:', initializationError);
        return { messageId: `mock-${Date.now()}` };
      },
      verify: async () => false
    };
    
    return emailConfig;
  }
}

/**
 * Test SMTP connection
 */
export const testSMTPConnection = async () => {
  try {
    const transporter = await getEmailTransporter();
    const isConnected = await transporter.verify();
    
    return {
      connected: isConnected,
      error: initializationError,
      config: {
        host: process.env.SMTP_HOST || 'not_set',
        port: process.env.SMTP_PORT || 'not_set', 
        secure: process.env.SMTP_SECURE || 'not_set',
        user: process.env.SMTP_USER ? 'configured' : 'not_set',
        pass: process.env.SMTP_PASS ? 'configured' : 'not_set',
        from: process.env.SMTP_FROM || 'not_set'
      }
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      config: {
        host: process.env.SMTP_HOST || 'not_set',
        port: process.env.SMTP_PORT || 'not_set',
        secure: process.env.SMTP_SECURE || 'not_set', 
        user: process.env.SMTP_USER ? 'configured' : 'not_set',
        pass: process.env.SMTP_PASS ? 'configured' : 'not_set',
        from: process.env.SMTP_FROM || 'not_set'
      }
    };
  }
};

/**
 * Send an email
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<boolean> => {
  try {
    const transporter = await getEmailTransporter();
    
    console.log('📧 Sending email:', {
      to: to.replace(/(.{1}).*@/, '$1***@'),
      subject,
      hasError: !!initializationError
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com',
      to,
      subject,
      html
    };

    const result = await transporter.sendMail(mailOptions);
    
    const isRealEmail = !result.messageId.startsWith('mock-');
    console.log('📧 Email result:', {
      messageId: result.messageId,
      isReal: isRealEmail,
      success: true
    });
    
    return isRealEmail;
    
  } catch (error) {
    console.error('📧 Email send failed:', error.message);
    return false;
  }
};

export default sendEmail; 