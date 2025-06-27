const nodemailer = require('nodemailer');
const qrcode = require('qrcode');
const { Event, Registration } = require('../models');
const logger = require('../utils/logger');
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
  } catch (err) {
    logger.error('Error generating QR code (buffer):', err);
    throw err;
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
  } catch (err) {
    logger.error('Error generating QR code (dataURL):', err);
    throw err;
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
        !event.emailSettings.enabled || 
        !event.emailSettings.automaticEmails || 
        !event.emailSettings.automaticEmails.registrationConfirmation) {
      logger.info(`Registration confirmation emails disabled for event: ${event._id}`);
      return false;
    }
    
    // Check if SMTP settings are configured
    if (!event.emailSettings.smtpHost || 
        !event.emailSettings.smtpUser || 
        !event.emailSettings.smtpPassword) {
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
      firstName: registration.personalInfo.firstName || 'Attendee',
      lastName: registration.personalInfo.lastName || '',
      eventName: event.name,
      registrationId: registration.registrationId,
      eventDate: formatDate(event.startDate),
      eventVenue: event.venue ? `${event.venue.name}, ${event.venue.city}, ${event.venue.country}` : 'Venue information not available'
    };
    
    // Process email template
    const emailTemplate = event.emailSettings.templates.registration;
    let emailBody = processTemplate(emailTemplate.body, emailData);
    
    // Replace QR code placeholder with cid reference. The same `cid` is used in
    // the attachments array below.
    emailBody = emailBody.replace('[QR_CODE]', `<img src="cid:qrcode" alt="Registration QR Code" style="max-width: 200px; height: auto;" />`);
    
    // Configure email
    const mailOptions = {
      from: `"${event.emailSettings.senderName}" <${event.emailSettings.senderEmail}>`,
      to: registration.personalInfo.email,
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
    if (event.emailSettings.replyToEmail) {
      mailOptions.replyTo = event.emailSettings.replyToEmail;
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

// Export functions
module.exports = {
  sendRegistrationConfirmationEmail,
  generateQRCodeDataURL,
  generateQRCodeBuffer,
  processTemplate
}; 
