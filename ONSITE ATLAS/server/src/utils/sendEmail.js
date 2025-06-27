const nodemailer = require('nodemailer');
const logger = require('./logger');
const config = require('../config/config');

/**
 * Generic email sender using global SMTP settings.
 * If specific SMTP credentials are provided in `options.smtp`, they override the globals.
 *
 * @param {Object} options
 * @param {string} options.to          Recipient email
 * @param {string} options.subject     Subject line
 * @param {string} options.html        HTML body
 * @param {string} [options.text]      Plain-text body (auto-generated from html if absent)
 * @param {string} [options.fromName]  Sender display name (default "Event Organizer")
 * @param {string} [options.fromEmail] Sender email (default from config)
 * @param {Object} [options.smtp]      Override SMTP { host, port, secure, auth:{user,pass} }
 */
const sendEmail = async (options = {}) => {
  const {
    to,
    subject,
    html,
    text,
    fromName = 'Event Organizer',
    fromEmail = config.email.from || 'noreply@example.com',
    smtp = {},
  } = options;

  if (!to) throw new Error('Recipient (to) is required for sendEmail');
  if (!subject) throw new Error('Subject is required for sendEmail');
  if (!html) throw new Error('HTML content is required for sendEmail');

  const smtpConfig = {
    host: smtp.host || config.email.smtp.host,
    port: smtp.port || config.email.smtp.port || 587,
    secure: smtp.secure !== undefined ? smtp.secure : (config.email.smtp.port === 465),
    auth: {
      user: (smtp.auth && smtp.auth.user) || (config.email.smtp.auth && config.email.smtp.auth.user),
      pass: (smtp.auth && smtp.auth.pass) || (config.email.smtp.auth && config.email.smtp.auth.pass),
    },
  };

  if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
    logger.error('[sendEmail] SMTP credentials missing. email NOT sent.');
    throw new Error('SMTP credentials not configured');
  }

  const transporter = nodemailer.createTransport(smtpConfig);

  const mailOptions = {
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    html,
    text: text || undefined,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[sendEmail] Mail sent to ${to}. MessageId: ${info.messageId}`);
    return true;
  } catch (err) {
    logger.error(`[sendEmail] Failed to send mail to ${to}: ${err.message}`);
    throw err;
  }
};

module.exports = sendEmail; 