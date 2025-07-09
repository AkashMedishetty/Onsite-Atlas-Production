const nodemailer = require('nodemailer');
const logger = require('../config/logger');
const qrcode = require('qrcode');
const { Event, Registration } = require('../models');
const { htmlToText } = require('html-to-text');

/**
 * Format a date string for email templates
 * @param {Date} date The date to format
 * @returns {string} Formatted date string
 */
const formatDate = (date) => {
  if (!date) return '';
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// ---------------------------------------------------------------------------
// QR-CODE HELPERS
// ---------------------------------------------------------------------------

/**
 * Generate a QR code PNG **buffer** (safer for email – will be embedded as an
 * inline attachment via cid instead of a base64 data-URI which many mail
 * clients strip).
 * @param {string} registrationId
 * @param {string} eventId
 * @returns {Promise<Buffer>} PNG image buffer
 */
const generateQRCodeBuffer = async (registrationId, eventId) => {
  try {
    const qrData = JSON.stringify({
      registrationId,
      eventId: eventId.toString(),
      timestamp: Date.now()
    });

    // qrcode.toBuffer produces a PNG Buffer
    return await qrcode.toBuffer(qrData, { type: 'png', errorCorrectionLevel: 'H' });
  } catch (error) {
    logger.error('Error generating QR code (buffer):', error);
    throw error;
  }
};

/**
 * (Kept for backward compatibility) Generate QR code as data-URL.
 * Certain templates or API consumers may still rely on it.
 * @deprecated Prefer {@link generateQRCodeBuffer} for email usage.
 */
const generateQRCodeDataURL = async (registrationId, eventId) => {
  try {
    const qrData = JSON.stringify({
      registrationId,
      eventId: eventId.toString(),
      timestamp: Date.now()
    });

    return await qrcode.toDataURL(qrData);
  } catch (error) {
    logger.error('Error generating QR code (dataURL):', error);
    throw error;
  }
};

/**
 * Replace template placeholders with actual data
 * @param {string} template The email template
 * @param {Object} data The data to replace placeholders with
 * @returns {string} Processed template
 */
const processTemplate = (template, data) => {
  if (!template) return '';
  
  let processed = template;
  
  // Replace all {{placeholders}} with actual values
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(regex, data[key] || '');
  });
  
  // Decode basic HTML entities that may have been escaped in MongoDB (&lt;, &gt;, &amp;)
  processed = processed
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  
  return processed;
};

/**
 * Create a transporter for sending emails
 * @param {Object} emailSettings SMTP settings
 * @returns {Object} Nodemailer transporter
 */
const createTransporter = (emailSettings) => {
  return nodemailer.createTransport({
    host: emailSettings.smtpHost,
    port: emailSettings.smtpPort || 587,
    secure: emailSettings.smtpSecure || false,
    auth: {
      user: emailSettings.smtpUser,
      pass: emailSettings.smtpPassword
    }
  });
};

/**
 * Send a registration confirmation email
 * @param {string} registrationId The registration ID
 * @returns {Promise<boolean>} Success status
 */
const sendRegistrationConfirmationEmail = async (registrationId) => {
  try {
    // Get registration data
    const registration = await Registration.findById(registrationId)
      .populate({
        path: 'event',
        select: 'name startDate endDate venue emailSettings'
      })
      .populate('category');
    
    if (!registration) {
      logger.error(`Registration not found: ${registrationId}`);
      return false;
    }
    
    const event = registration.event;
    
    // Check if email is enabled and registration confirmation is enabled
    if (!event.emailSettings || 
        !event?.emailSettings.enabled || 
        !event?.emailSettings.automaticEmails || 
        !event?.emailSettings.automaticEmails.registrationConfirmation) {
      logger.info(`Registration confirmation emails disabled for event: ${event._id}`);
      return false;
    }
    
    // Check if SMTP settings are configured
    if (!event?.emailSettings.smtpHost || 
        !event?.emailSettings.smtpUser || 
        !event?.emailSettings.smtpPassword) {
      logger.error(`SMTP not configured for event: ${event._id}`);
      return false;
    }
    
    // ---------------------------------------------------------------------
    // Generate QR code (PNG buffer) & set up cid attachment so that it shows
    // reliably in Gmail / Outlook, which strip data-URI images.
    // ---------------------------------------------------------------------

    const qrCodeBuffer = await generateQRCodeBuffer(registration._id, event._id);
    
    // Prepare email data
    const emailData = {
      firstName: registration?.personalInfo?.firstName || 'Attendee',
      lastName: registration?.personalInfo?.lastName || '',
      eventName: event.name,
      registrationId: registration.registrationId,
      eventDate: formatDate(event.startDate),
      eventVenue: event.venue ? `${event?.venue?.name}, ${event?.venue?.city}, ${event?.venue?.country}` : 'Venue information not available'
    };
    
    // Process email template
    const emailTemplate = event?.emailSettings?.templates.registration;
    let emailBody = processTemplate(emailTemplate.body, emailData);
    
    // Replace QR code placeholder with cid reference. The same `cid` is used in
    // the attachments array below.
    emailBody = emailBody.replace('[QR_CODE]', `<img src="cid:qrcode" alt="Registration QR Code" style="max-width: 200px; height: auto;" />`);
    
    // Configure email
    const mailOptions = {
      from: `"${event?.emailSettings?.senderName}" <${event?.emailSettings?.senderEmail}>`,
      to: registration?.personalInfo?.email,
      subject: processTemplate(emailTemplate.subject, emailData),
      html: emailBody,
      text: htmlToText(emailBody, { wordwrap: 130 }),
      attachments: [
        {
          filename: `qrcode-${registration.registrationId}.png`,
          content: qrCodeBuffer,
          contentType: 'image/png',
          cid: 'qrcode' // same as in the img src above
        }
      ]
    };
    
    // Add reply-to if configured
    if (event?.emailSettings?.replyToEmail) {
      mailOptions.replyTo = event?.emailSettings?.replyToEmail;
    }
    
    // Send email
    const transporter = createTransporter(event.emailSettings);
    const info = await transporter.sendMail(mailOptions);
    
    logger.info(`Registration confirmation email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error('Error sending registration confirmation email:', error);
    return false;
  }
};

/**
 * Send invoice email with PDF attachment when payment succeeds
 * @param {string} paymentId
 */
const sendPaymentInvoiceEmail = async (paymentId) => {
  try {
    const Payment = require('../models/Payment');
    const payment = await Payment.findById(paymentId)
      .populate('event')
      .populate('registration');
  if (!payment) {
      logger.error(`Payment not found: ${paymentId}`);
      return false;
    }
    const event = payment.event;
    const registration = payment.registration;
    if (!event?.emailSettings?.enabled) return false;
    if (!event?.emailSettings.smtpHost) return false;

    const transporter = createTransporter(event.emailSettings);

    const placeholders = {
      firstName: registration?.personalInfo?.firstName || '',
      lastName: registration?.personalInfo?.lastName || '',
      eventName: event.name,
      amount: (payment.amountCents/100).toFixed(2),
      currency: payment.currency,
      registrationId: registration?.registrationId || '',
    };

    const tmpl = event?.emailSettings?.templates?.paymentInvoice || { subject: 'Payment Confirmation - {{eventName}}', body: 'Dear {{firstName}},<br/><br/>We have received your payment of {{currency}} {{amount}} for {{eventName}}. Your registration ID is {{registrationId}}.<br/><br/>Regards,<br/>Team' };

    const cfgExtra = event.paymentConfig?.extra || {};
    const subjectTpl = cfgExtra.invoiceEmailSubject || tmpl.subject;
    const bodyTpl = cfgExtra.invoiceEmailBody || tmpl.body;

    const subject = processTemplate(subjectTpl, placeholders);
    const htmlBody = processTemplate(bodyTpl, placeholders);

    const path = require('path');
    const fs = require('fs');
    const invoicePath = path.join(__dirname, '..', 'public', payment.invoiceUrl || '');
    const attachments = [];
    if(fs.existsSync(invoicePath)){
      attachments.push({ filename: path.basename(invoicePath), path: invoicePath });
    }

    await transporter.sendMail({
      from: event?.emailSettings?.senderEmail,
      to: registration?.personalInfo?.email,
      subject,
      html: htmlBody,
      text: htmlToText(htmlBody),
      attachments,
    });
    return true;
  } catch (error) { logger.error('sendPaymentInvoiceEmail error',error); return false; }
};

// Export functions
module.exports = {
  sendRegistrationConfirmationEmail,
  generateQRCodeDataURL,
  generateQRCodeBuffer,
  processTemplate,
  sendPaymentInvoiceEmail,
  sendGenericEmail: async ({ to, subject, html, from }) => {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process?.env?.SMTP_HOST || 'localhost',
      port: process?.env?.SMTP_PORT ? parseInt(process?.env?.SMTP_PORT) : 587,
      secure: false,
      auth: process?.env?.SMTP_USER ? { user: process?.env?.SMTP_USER, pass: process?.env?.SMTP_PASS } : undefined,
    });
    await transporter.sendMail({ from, to, subject, html });
  }
}; 
