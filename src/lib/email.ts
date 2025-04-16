import nodemailer, { Transporter } from 'nodemailer';

// Create a transporter using environment variables
let transporter: Transporter;

try {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} catch (error) {
  console.error('Error creating email transporter:', error);
  // Create a mock transporter for development
  transporter = {
    sendMail: async (options) => {
      console.log('Development mode - Email would have been sent:');
      console.log('To:', options.to);
      console.log('Subject:', options.subject);
      console.log('Content:', options.html);
      return { messageId: 'mock-id' };
    },
  } as Transporter;
}

/**
 * Sends an email using the configured SMTP transport
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - Email content in HTML format
 * @returns Promise<boolean> - True if email was sent successfully
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<boolean> => {
  try {
    console.log(JSON.stringify({
      type: 'email_send_attempt',
      to: to.split('@')[1] ? `${to.split('@')[0].charAt(0)}***@${to.split('@')[1]}` : '***',
      subject,
      timestamp: new Date().toISOString()
    }));
    
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(JSON.stringify({
      type: 'email_send_success',
      messageId: info.messageId,
      timestamp: new Date().toISOString()
    }));
    return true;
  } catch (error) {
    console.error(JSON.stringify({
      type: 'email_send_error',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    return false;
  }
}

// Re-export for better module compatibility
export default sendEmail; 