const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Certificate = require('../models/Certificate');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { createCanvas, loadImage } = require('canvas');
const PDFDocument = require('pdfkit');
const asyncHandler = require('express-async-handler');
const { sendSuccess } = require('../utils/responseFormatter');
const StandardErrorHandler = require('../utils/standardErrorHandler');
const emailService = require('../services/emailService');
const { buildUploadDir } = require('../config/paths');
const { createApiError } = require('../middleware/error');
const sendEmail = require('../utils/sendEmail');
const { processTemplate } = require('../services/emailService');

/**
 * Now supports attachments:
 * - Accepts attachments via req.files (multer)
 * - Sends attachments with emails using nodemailer
 * - Saves attachment info in email history
 *
 * @desc    Send email to filtered recipients
 * @route   POST /api/events/:eventId/emails/send
 * @access  Private
 */
exports.sendEmail = asyncHandler(async (req, res) => {
  logger.info('[EMAIL SEND] Endpoint hit. req.body:', req.body, 'req.files:', req.files);
  const { eventId } = req.params;
  // express-fileupload: req.files.attachments can be a single file or array
  let attachments = [];
  if (req.files && req.files.attachments) {
    const files = Array.isArray(req.files.attachments) ? req.files.attachments : [req.files.attachments];
    // Save files to disk and build attachments array for nodemailer
    const uploadDir = buildUploadDir();
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    attachments = files.map(file => {
      const filePath = require('path').join(uploadDir, file.name);
      fs.writeFileSync(filePath, file.data);
      return {
        filename: file.name,
        path: filePath
      };
    });
  }
  // Parse email and filters from req.body (may be JSON strings)
  let email = req.body.email;
  let filters = req.body.filters;
  if (typeof email === 'string') email = JSON.parse(email);
  if (typeof filters === 'string') filters = JSON.parse(filters);
  
  // Get event with email settings
  const event = await Event.findById(eventId);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found'
    });
  }

  // Check if email settings are configured
  if (!event.emailSettings || !event.emailSettings.enabled) {
    return res.status(400).json({
      success: false,
      message: 'Email settings are not enabled for this event'
    });
  }

  // Find recipients based on filters
  let query = { event: eventId };
  let recipients = [];
  
  // Apply category filter
  if (filters.categories && filters.categories.length > 0) {
    query.category = { $in: filters.categories };
  }
  
  // Apply workshop filter
  if (filters.workshopFilter === 'withWorkshop') {
    query['registrationType'] = 'workshop';
  } else if (filters.workshopFilter === 'withoutWorkshop') {
    query['registrationType'] = { $ne: 'workshop' };
  }
  
  // If specific emails are provided, use those instead of filters
  if (filters.specificEmails && filters.specificEmails.length > 0) {
    const specificRegistrations = await Registration.find({
      event: eventId,
      'personalInfo.email': { $in: filters.specificEmails }
    }).populate('category');
    
    recipients = specificRegistrations;
    
    // For emails that don't have registrations, create placeholder objects
    const registrationEmails = specificRegistrations.map(r => r.personalInfo.email);
    const missingEmails = filters.specificEmails.filter(email => !registrationEmails.includes(email));
    
    missingEmails.forEach(email => {
      recipients.push({
        personalInfo: {
          firstName: 'Recipient',
          lastName: '',
          email: email
        },
        registrationId: 'MANUAL',
        category: { name: 'Manual Entry' }
      });
    });
  } else {
    recipients = await Registration.find(query).populate('category');
  }
  
  if (recipients.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No recipients match the specified criteria'
    });
  }

  // Configure nodemailer with SMTP settings
  const transporter = nodemailer.createTransport({
    host: event.emailSettings.smtpHost,
    port: event.emailSettings.smtpPort || 587,
    secure: event.emailSettings.smtpSecure || false,
    auth: {
      user: event.emailSettings.smtpUser,
      pass: event.emailSettings.smtpPassword
    }
  });

  // Create a record of this email batch with enhanced tracking
  const startTime = new Date();
  const emailBatch = {
    subject: email.subject,
    date: startTime,
    recipients: recipients.length,
    sent: 0,
    failed: 0,
    pending: recipients.length,
    status: 'pending',
    errors: [],
    templateUsed: email.templateUsed || 'custom',
    attachments: attachments.map(f => ({ 
      filename: f.filename, 
      originalName: f.originalname || f.filename,
      size: f.size,
      mimeType: f.mimetype
    })),
    filters: {
      categories: req.body.categories || [],
      registrationStatus: req.body.registrationStatus || [],
      paymentStatus: req.body.paymentStatus || [],
      audience: req.body.audience || [],
      specificEmails: req.body.specificEmails || [],
      workshops: req.body.workshops || []
    },
    sentBy: req.user._id,
    sentByName: req.user.firstName + ' ' + req.user.lastName,
    sentByEmail: req.user.email,
    deliveryStats: {
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0
    },
    processingTime: {
      startTime: startTime,
      endTime: null,
      durationMs: null
    }
  };

  if (!event.emailHistory) {
    event.emailHistory = [];
  }
  
  event.emailHistory.unshift(emailBatch);
  await event.save();

  // Send emails to all recipients
  let sentCount = 0;
  let failedCount = 0;
  const errors = [];

  for (const recipient of recipients) {
    try {
      // Replace placeholders in template
      const personalInfo = recipient.personalInfo || {};
      let emailBody = email.body;
      
      // Replace placeholders with recipient data
      emailBody = emailBody
        .replace(/{{firstName}}/g, personalInfo.firstName || 'Attendee')
        .replace(/{{lastName}}/g, personalInfo.lastName || '')
        .replace(/{{registrationId}}/g, recipient.registrationId || '')
        .replace(/{{eventName}}/g, event.name)
        .replace(/{{eventDate}}/g, formatDate(event.startDate))
        .replace(/{{eventVenue}}/g, event.venue ? `${event.venue.name}, ${event.venue.city}` : 'TBA');
      
      // Generate QR code if requested
      if (emailBody.includes('[QR_CODE]') && recipient._id) {
        try {
          const qrCodeDataUrl = await generateQRCode(recipient._id, event._id);
          emailBody = emailBody.replace('[QR_CODE]', `<img src="${qrCodeDataUrl}" alt="Registration QR Code" style="max-width: 200px; height: auto;" />`);
        } catch (error) {
          logger.error('Error generating QR code:', qrError);
          emailBody = emailBody.replace('[QR_CODE]', '[QR code could not be generated]');
        }
      } else {
        emailBody = emailBody.replace('[QR_CODE]', '');
      }
      
      // Configure email options
      const mailOptions = {
        from: `"${event.emailSettings.senderName}" <${event.emailSettings.senderEmail}>`,
        to: personalInfo.email,
        subject: email.subject
          .replace(/{{eventName}}/g, event.name)
          .replace(/{{firstName}}/g, personalInfo.firstName || 'Attendee'),
        html: emailBody,
        attachments: attachments
      };
      
      // Add reply-to if configured
      if (event.emailSettings.replyToEmail) {
        mailOptions.replyTo = event.emailSettings.replyToEmail;
      }
      
      // Send email
      await transporter.sendMail(mailOptions);
      sentCount++;
    } catch (error) {
      failedCount++;
      // Enhanced error tracking with more details
      const errorEntry = {
        email: recipient.personalInfo?.email || 'unknown',
        error: error.message,
        errorCode: error.code || 'UNKNOWN',
        timestamp: new Date()
      };
      
      errors.push(errorEntry);
      event.emailHistory[0].errors.push(errorEntry);
    }
  }

  // Update email batch status with processing time
  const endTime = new Date();
  const durationMs = endTime - startTime;
  
  event.emailHistory[0].status = failedCount === 0 ? 'completed' : 
                                  sentCount === 0 ? 'failed' : 'completed_with_errors';
  event.emailHistory[0].sent = sentCount;
  event.emailHistory[0].failed = failedCount;
  event.emailHistory[0].pending = 0;
  event.emailHistory[0].processingTime.endTime = endTime;
  event.emailHistory[0].processingTime.durationMs = durationMs;
  
  await event.save();

  return res.status(200).json({
    success: true,
    message: `Email sent to ${sentCount} recipients (${failedCount} failed)`,
    data: {
      sent: sentCount,
      failed: failedCount,
      errors
    }
  });
});

/**
 * @desc    Get filtered recipients for email preview
 * @route   POST /api/events/:eventId/emails/recipients
 * @access  Private
 */
exports.getFilteredRecipients = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const filters = req.body;
  
  // Set up base query
  let query = { event: eventId };
  
  // Apply category filter
  if (filters.categories && filters.categories.length > 0) {
    query.category = { $in: filters.categories };
  }
  
  // Apply workshop filter
  if (filters.workshopFilter === 'withWorkshop') {
    query['registrationType'] = 'workshop';
  } else if (filters.workshopFilter === 'withoutWorkshop') {
    query['registrationType'] = { $ne: 'workshop' };
  }
  
  // Get count of matching registrations
  const count = await Registration.countDocuments(query);
  
  // Get sample of recipients for preview
  const recipients = await Registration.find(query)
    .populate('category', 'name')
    .select('personalInfo.firstName personalInfo.lastName personalInfo.email personalInfo.organization registrationId')
    .limit(10);
  
  return res.status(200).json({
    success: true,
    data: {
      totalCount: count,
      sample: recipients
    }
  });
});

/**
 * @desc    Get email history for an event
 * @route   GET /api/events/:eventId/emails/history
 * @access  Private
 */
exports.getEmailHistory = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  
  const event = await Event.findById(eventId);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found'
    });
  }
  
  return res.status(200).json({
    success: true,
    data: event.emailHistory || []
  });
});

/**
 * @desc    Get email history debug for an event
 * @route   GET /api/events/:eventId/emails/history-debug
 * @access  Private
 */
exports.getEmailHistoryDebug = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  
  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Email history retrieved successfully',
      data: event.emailHistory || [],
      debug: {
        eventId,
        hasEmailHistory: Boolean(event.emailHistory),
        historyLength: event.emailHistory ? event.emailHistory.length : 0
      }
    });
  } catch (error) {
    logger.error('Error retrieving email history debug:', error);
    return res.status(200).json({
      success: true,
      message: 'Error retrieving email history',
      data: [],
      error: error.message
    });
  }
});

/**
 * @desc    Get email templates for an event
 * @route   GET /api/events/:eventId/emails/templates
 * @access  Private
 */
exports.getTemplates = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  
  const event = await Event.findById(eventId).select('emailSettings.templates');
  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found'
    });
  }
  
  const templates = event.emailSettings?.templates || {};

  // Default templates keys to ensure exist
  const defaultKeys = ['registration','reminder','certificate','workshop','scientificBrochure','custom','abstractSubmission','abstractApproved','abstractRejected','abstractRevisionRequested','authorSignup'];
  let updated=false;
  for(const k of defaultKeys){
    if(!templates[k]){
      // Pull default from Mongoose schema defaults
      const pathDef = Event.schema.path('emailSettings.templates.'+k);
      if(pathDef && pathDef.defaultValue){ templates[k] = pathDef.defaultValue; }
      else templates[k]={ subject:'', body:'' };
      updated=true;
    }
  }
  if(updated){
    event.emailSettings.templates = templates;
    await event.save();
  }
  return StandardErrorHandler.sendSuccess(res, 200, 'Email templates retrieved successfully', templates);
});

/**
 * @desc    Test SMTP configuration
 * @route   POST /api/events/:eventId/emails/test-smtp
 * @access  Private
 */
exports.testSmtpConfiguration = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const user = req.user;
  logger.info('[testSmtpConfiguration] Called with eventId:', eventId, 'by user:', user ? user.email : 'unknown');

  if (!req.body.testEmail) {
    logger.error('[testSmtpConfiguration] No testEmail provided in request body:', req.body);
    return res.status(400).json({
      success: false,
      message: 'Test email address is required'
    });
  }

  const event = await Event.findById(eventId);
  if (!event) {
    logger.error('[testSmtpConfiguration] Event not found for eventId:', eventId);
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  // Check for all required SMTP fields
  const es = event.emailSettings || {};
  const missingFields = [];
  if (!es.enabled) missingFields.push('enabled');
  if (!es.smtpHost) missingFields.push('smtpHost');
  if (!es.smtpPort) missingFields.push('smtpPort');
  if (!es.smtpUser) missingFields.push('smtpUser');
  if (!es.smtpPassword) missingFields.push('smtpPassword');
  if (!es.senderName) missingFields.push('senderName');
  if (!es.senderEmail) missingFields.push('senderEmail');

  if (missingFields.length > 0) {
    logger.error('[testSmtpConfiguration] Missing SMTP fields:', missingFields);
    return res.status(400).json({
      success: false,
      message: 'SMTP settings are not fully configured. Missing: ' + missingFields.join(', ')
    });
  }

  // Log SMTP config (mask password)
  logger.info('[testSmtpConfiguration] SMTP config:', {
    smtpHost: es.smtpHost,
    smtpPort: es.smtpPort,
    smtpUser: es.smtpUser,
    smtpSecure: es.smtpSecure,
    senderName: es.senderName,
    senderEmail: es.senderEmail,
    replyToEmail: es.replyToEmail,
    enabled: es.enabled
  });

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: es.smtpHost,
      port: es.smtpPort,
      secure: es.smtpSecure,
      auth: {
        user: es.smtpUser,
        pass: es.smtpPassword
      }
    });

    // Log test email details
    logger.info('[testSmtpConfiguration] Sending test email to:', req.body.testEmail);

    const info = await transporter.sendMail({
      from: `"${es.senderName}" <${es.senderEmail}>`,
      to: req.body.testEmail,
      subject: `Test Email from ${event.name}`,
      html: `
        <h1>SMTP Configuration Test</h1>
        <p>This is a test email from ${event.name} to verify that your SMTP configuration is working correctly.</p>
        <p>If you received this email, your email settings are configured correctly!</p>
      `
    });

    logger.info('[testSmtpConfiguration] Test email sent. MessageId:', info.messageId);
    return res.status(200).json({
      success: true,
      message: `Test email sent successfully to ${req.body.testEmail}`,
      data: {
        messageId: info.messageId
      }
    });
  } catch (error) {
    logger.error('[testSmtpConfiguration] Error sending test email:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message
    });
  }
});

/**
 * @desc    Upload certificate template
 * @route   POST /api/events/:eventId/emails/certificate-template
 * @access  Private
 */
exports.uploadCertificateTemplate = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }
  
  const event = await Event.findById(eventId);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found'
    });
  }
  
  // Save the file path to the event's email settings
  if (!event.emailSettings) {
    event.emailSettings = {};
  }
  
  event.emailSettings.certificateTemplate = req.file.path;
  await event.save();
  
  return res.status(200).json({
    success: true,
    message: 'Certificate template uploaded successfully',
    data: {
      filePath: req.file.path
    }
  });
});

/**
 * @desc    Upload scientific brochure
 * @route   POST /api/events/:eventId/emails/brochure
 * @access  Private
 */
exports.uploadBrochure = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }
  
  const event = await Event.findById(eventId);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found'
    });
  }
  
  // Save the file path to the event's email settings
  if (!event.emailSettings) {
    event.emailSettings = {};
  }
  
  event.emailSettings.scientificBrochure = req.file.path;
  await event.save();
  
  return res.status(200).json({
    success: true,
    message: 'Scientific brochure uploaded successfully',
    data: {
      filePath: req.file.path
    }
  });
});

/**
 * @desc    Validate certificate authenticity
 * @route   GET /api/certificates/validate/:certificateId
 * @access  Public
 */
exports.validateCertificate = asyncHandler(async (req, res) => {
  const { certificateId } = req.params;
  
  // Get IP address for tracking validation
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
  
  // Find certificate
  const certificate = await Certificate.findOne({ certificateId })
    .populate('event', 'name startDate endDate')
    .populate('registration', 'personalInfo');
  
  if (!certificate) {
    return res.status(404).json({
      success: false,
      message: 'Certificate not found or invalid',
      verified: false
    });
  }
  
  // Record verification
  certificate.verified.push({
    date: new Date(),
    ipAddress
  });
  
  await certificate.save();
  
  return res.status(200).json({
    success: true,
    message: 'Certificate successfully verified',
    verified: true,
    data: {
      certificateId: certificate.certificateId,
      recipient: certificate.recipientName,
      eventName: certificate.eventName,
      eventDate: certificate.event ? `${formatDate(certificate.event.startDate)} - ${formatDate(certificate.event.endDate)}` : 'Not available',
      issueDate: formatDate(certificate.issueDate),
      verifications: certificate.verified.length
    }
  });
});

/**
 * Helper function to format a date
 */
function formatDate(date) {
  if (!date) return '';
  
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Helper function to generate QR code
 */
async function generateQRCode(registrationId, eventId) {
  try {
    const qrData = JSON.stringify({
      registrationId,
      eventId: eventId.toString(),
      timestamp: Date.now()
    });
    
    return await qrcode.toDataURL(qrData);
  } catch (error) {
    logger.error('Error generating QR code:', error);
    throw error;
  }
}

/**
 * Supported template placeholders:
 *   {{firstName}}, {{lastName}}, {{registrationId}}, {{eventName}}, {{eventDate}}, {{eventVenue}}, [QR_CODE]
 *
 * @desc    Update email templates for an event
 * @route   PUT /api/events/:eventId/emails/templates
 * @access  Private
 */
exports.updateTemplates = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { templates } = req.body;

  if (!templates || typeof templates !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Templates object is required'
    });
  }

  // Define required placeholders for each template type
  const requiredPlaceholders = {
    registration: ['{{firstName}}', '{{eventName}}', '{{registrationId}}', '[QR_CODE]'],
    reminder: ['{{firstName}}', '{{eventName}}', '{{eventDate}}', '{{eventVenue}}'],
    certificate: ['{{firstName}}', '{{eventName}}'],
    workshop: ['{{firstName}}', '{{eventName}}', '{{workshopTitle}}', '{{workshopDate}}', '{{workshopTime}}', '{{workshopLocation}}'],
    scientificBrochure: ['{{firstName}}', '{{eventName}}'],
    custom: ['{{firstName}}', '{{eventName}}']
  };

  // Validate each template
  for (const [templateName, fields] of Object.entries(templates)) {
    const required = requiredPlaceholders[templateName] || [];
    const body = fields.body || '';
    for (const placeholder of required) {
      if (!body.includes(placeholder)) {
        return res.status(400).json({
          success: false,
          message: `Template '${templateName}' is missing required placeholder: ${placeholder}`
        });
      }
    }
  }

  const event = await Event.findById(eventId);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found'
    });
  }

  event.emailSettings = event.emailSettings || {};
  event.emailSettings.templates = templates;
  // Ensure nested changes are persisted
  event.markModified('emailSettings.templates');
  await event.save();

  return res.status(200).json({
    success: true,
    message: 'Email templates updated successfully',
    data: event.emailSettings.templates
  });
});

/**
 * @desc    Update SMTP settings for an event
 * @route   PUT /api/events/:eventId/emails/smtp-settings
 * @access  Private
 */
exports.updateSmtpSettings = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const smtpFields = [
    'enabled', 'senderName', 'senderEmail', 'replyToEmail',
    'smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'smtpSecure'
  ];
  const event = await Event.findById(eventId);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found'
    });
  }
  event.emailSettings = event.emailSettings || {};
  smtpFields.forEach(field => {
    if (req.body[field] !== undefined) {
      event.emailSettings[field] = req.body[field];
    }
  });
  await event.save();
  return res.status(200).json({
    success: true,
    message: 'SMTP settings updated successfully',
    data: event.emailSettings
  });
});

// PUT /api/events/:eventId/emails/templates/:templateKey
exports.updateTemplate = asyncHandler(async (req,res,next)=>{
  const { eventId, templateKey } = req.params;
  const { subject, body } = req.body;
  const event = await Event.findById(eventId);
  if(!event) return next(createApiError('Event not found',404));
  if(!event.emailSettings) event.emailSettings = {};
  if(!event.emailSettings.templates) event.emailSettings.templates = {};
  event.emailSettings.templates[templateKey] = {
    subject: subject || '',
    body: body || ''
  };
  // Ensure Mongoose tracks nested object changes
  event.markModified('emailSettings.templates');
  await event.save();
  return StandardErrorHandler.sendSuccess(res, 200, 'Email template retrieved successfully', event.emailSettings.templates[templateKey]);
});

// POST /api/events/:eventId/emails/preview
// body: { filters, templateKey, placeholders }
exports.previewRecipients = asyncHandler(async (req,res,next)=>{
  // For now, return stub with totalCount 0; full logic later.
  return StandardErrorHandler.sendSuccess(res, 200, 'Email history retrieved successfully', { totalCount: 0, sample: [] });
});

// POST /api/events/:eventId/emails/send
exports.sendCustomEmail = asyncHandler(async (req,res,next)=>{
  const { eventId } = req.params;
  const { subject, body, to } = req.body; // to can be single or array
  if(!subject || !body || !to) return next(createApiError('subject, body and to are required',400));
  const event = await Event.findById(eventId);
  if(!event) return next(createApiError('Event not found',404));

  let recipients = Array.isArray(to)? to : [to];
  let sent=0, failed=0, errors=[];
  for(const email of recipients){
    try{
      await sendEmail({
        to: email,
        subject,
        html: body,
        fromName: event.emailSettings?.senderName || 'Event Team',
        fromEmail: event.emailSettings?.senderEmail || 'noreply@example.com',
        smtp: {
          host: event.emailSettings?.smtpHost,
          port: event.emailSettings?.smtpPort,
          secure: event.emailSettings?.smtpSecure,
          auth: {
            user: event.emailSettings?.smtpUser,
            pass: event.emailSettings?.smtpPassword
          }
        }
      });
      sent++;
    } catch (error) {
      failed++;
      errors.push({ email, error: err.message });
    }
  }
  return StandardErrorHandler.sendSuccess(res, 200, 'Email sent successfully', { sent, failed, errors });
});

/**
 * @desc    Get enhanced email history with failure analysis
 * @route   GET /api/events/:eventId/emails/history-enhanced
 * @access  Private
 */
exports.getEnhancedEmailHistory = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { page = 1, limit = 20, status, templateUsed, dateFrom, dateTo } = req.query;

  const event = await Event.findById(eventId).populate('emailHistory.sentBy', 'firstName lastName email');
  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found'
    });
  }

  let emailHistory = event.emailHistory || [];

  // Apply filters
  if (status) {
    emailHistory = emailHistory.filter(email => email.status === status);
  }
  
  if (templateUsed) {
    emailHistory = emailHistory.filter(email => email.templateUsed === templateUsed);
  }
  
  if (dateFrom || dateTo) {
    emailHistory = emailHistory.filter(email => {
      const emailDate = new Date(email.date);
      if (dateFrom && emailDate < new Date(dateFrom)) return false;
      if (dateTo && emailDate > new Date(dateTo)) return false;
      return true;
    });
  }

  // Calculate statistics
  const stats = emailHistory.reduce((acc, email) => {
    acc.totalEmails++;
    acc.totalRecipients += email.recipients || 0;
    acc.totalSent += email.sent || 0;
    acc.totalFailed += email.failed || 0;
    acc.totalErrors += (email.errors || []).length;
    
    if (email.status === 'completed') acc.completed++;
    else if (email.status === 'completed_with_errors') acc.completedWithErrors++;
    else if (email.status === 'failed') acc.failed++;
    else if (email.status === 'pending') acc.pending++;
    
    return acc;
  }, {
    totalEmails: 0,
    totalRecipients: 0,
    totalSent: 0,
    totalFailed: 0,
    totalErrors: 0,
    completed: 0,
    completedWithErrors: 0,
    failed: 0,
    pending: 0
  });

  // Success rate calculation
  stats.successRate = stats.totalRecipients > 0 
    ? ((stats.totalSent / stats.totalRecipients) * 100).toFixed(2)
    : 0;

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedHistory = emailHistory.slice(startIndex, endIndex);

  // Get common error patterns
  const errorPatterns = {};
  emailHistory.forEach(email => {
    if (email.errors && email.errors.length > 0) {
      email.errors.forEach(error => {
        const pattern = error.errorCode || 'UNKNOWN';
        errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1;
      });
    }
  });

  return res.status(200).json({
    success: true,
    data: {
      history: paginatedHistory,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(emailHistory.length / limit),
        totalItems: emailHistory.length,
        itemsPerPage: parseInt(limit)
      },
      statistics: stats,
      errorPatterns: Object.entries(errorPatterns)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10) // Top 10 error patterns
        .map(([pattern, count]) => ({ pattern, count }))
    }
  });
});

/**
 * @desc    Get detailed failure report for specific email
 * @route   GET /api/events/:eventId/emails/:emailId/failures
 * @access  Private
 */
exports.getEmailFailureReport = asyncHandler(async (req, res) => {
  const { eventId, emailId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found'
    });
  }

  const emailRecord = event.emailHistory.id(emailId);
  if (!emailRecord) {
    return res.status(404).json({
      success: false,
      message: 'Email record not found'
    });
  }

  // Group errors by type for analysis
  const errorAnalysis = {};
  if (emailRecord.errors) {
    emailRecord.errors.forEach(error => {
      const errorType = error.errorCode || 'UNKNOWN';
      if (!errorAnalysis[errorType]) {
        errorAnalysis[errorType] = {
          count: 0,
          emails: [],
          description: getErrorDescription(errorType)
        };
      }
      errorAnalysis[errorType].count++;
      errorAnalysis[errorType].emails.push({
        email: error.email,
        error: error.error,
        timestamp: error.timestamp
      });
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      emailRecord: {
        subject: emailRecord.subject,
        date: emailRecord.date,
        status: emailRecord.status,
        recipients: emailRecord.recipients,
        sent: emailRecord.sent,
        failed: emailRecord.failed,
        processingTime: emailRecord.processingTime
      },
      errorAnalysis,
      totalErrors: emailRecord.errors ? emailRecord.errors.length : 0
    }
  });
});

// Helper function to get error descriptions
function getErrorDescription(errorCode) {
  const descriptions = {
    'ENOTFOUND': 'SMTP server not found - check host configuration',
    'ECONNREFUSED': 'Connection refused - SMTP server may be down',
    'EAUTH': 'Authentication failed - check username/password',
    'EMESSAGE': 'Message format error - check email content',
    'ETIMEDOUT': 'Connection timeout - server may be overloaded',
    'EENVELOPE': 'Invalid recipient email address',
    'UNKNOWN': 'Unknown error - check logs for details'
  };
  return descriptions[errorCode] || 'Unrecognized error code';
}

/**
 * @desc    Send bulk emails to selected registrations
 * @route   POST /api/events/:eventId/emails/bulk-send
 * @access  Private
 */
exports.sendBulkEmail = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { registrationIds, subject, message, templateId } = req.body;

  if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Registration IDs array is required'
    });
  }

  if (!subject || !message) {
    return res.status(400).json({
      success: false,
      message: 'Subject and message are required'
    });
  }

  const event = await Event.findById(eventId);
  if (!event) {
    return res.status(404).json({
      success: false,
      message: 'Event not found'
    });
  }

  // Get registrations with email addresses
  const Registration = require('../models/Registration');
  const registrations = await Registration.find({
    _id: { $in: registrationIds },
    'personalInfo.email': { $exists: true, $ne: '' }
  });

  if (registrations.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No registrations with valid email addresses found'
    });
  }

  const sendEmail = require('../services/emailService');
const logger = require('../utils/logger');
  let sent = 0;
  let failed = 0;
  const errors = [];

  // Process each registration
  for (const registration of registrations) {
    try {
      const email = registration.personalInfo.email;
      const personalizedMessage = message
        .replace(/\{firstName\}/g, registration.personalInfo.firstName || 'Dear Participant')
        .replace(/\{lastName\}/g, registration.personalInfo.lastName || '')
        .replace(/\{registrationId\}/g, registration.registrationId || registration._id)
        .replace(/\{eventName\}/g, event.name || 'Event');

      await sendEmail({
        to: email,
        subject,
        html: personalizedMessage,
        fromName: event.emailSettings?.senderName || 'Event Team',
        fromEmail: event.emailSettings?.senderEmail || 'noreply@example.com',
        smtp: {
          host: event.emailSettings?.smtpHost,
          port: event.emailSettings?.smtpPort,
          secure: event.emailSettings?.smtpSecure,
          auth: {
            user: event.emailSettings?.smtpUser,
            pass: event.emailSettings?.smtpPassword
          }
        }
      });
      sent++;
    } catch (error) {
      failed++;
      errors.push({ 
        registrationId: registration._id,
        email: registration.personalInfo.email,
        error: err.message 
      });
    }
  }

  // Log email activity to event history
  if (!event.emailHistory) event.emailHistory = [];
  event.emailHistory.push({
    subject,
    recipients: registrations.length,
    sent,
    failed,
    date: new Date(),
    status: failed === 0 ? 'completed' : (sent > 0 ? 'completed_with_errors' : 'failed'),
    templateUsed: templateId || 'custom',
    sentBy: req.user._id,
    errors: errors.map(e => ({
      email: e.email,
      error: e.error,
      errorCode: 'UNKNOWN',
      timestamp: new Date()
    }))
  });

  await event.save();

  return res.status(200).json({
    success: true,
    message: 'Bulk email processing completed',
    data: {
      totalRegistrations: registrations.length,
      sent,
      failed,
      errors
    }
  });
});
