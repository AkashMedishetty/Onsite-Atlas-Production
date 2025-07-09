const express = require('express');
const router = express.Router({ mergeParams: true });
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../middleware/async');
const AuthorUser = require('../models/AuthorUser');
const Event = require('../models/Event');
const ErrorResponse = require('../utils/errorResponse');
const logger = require('../config/logger');
const sendEmail = require('../utils/sendEmail');
const StandardErrorHandler = require('../utils/standardErrorHandler');

// Helpers
const signJwt = (author) => {
  const secret = process.env.AUTHOR_JWT_SECRET || process.env.JWT_SECRET;
  const expires = process.env.AUTHOR_JWT_EXPIRES_IN || '30d';
  return jwt.sign({ id: author._id, role: 'author', event: author.event.toString() }, secret, {
    expiresIn: expires,
  });
};

// POST /api/author-auth/signup
router.post('/signup', asyncHandler(async (req, res, next) => {
  const { eventId, name, email, mobile, password } = req.body;
  if (!eventId || !name || !email || !mobile || !password) {
    return next(new ErrorResponse('Missing required fields', 400));
  }
  const event = await Event.findById(eventId);
  if (!event) return next(new ErrorResponse('Event not found', 404));

  const exists = await AuthorUser.findOne({ email, event: eventId });
  if (exists) return next(new ErrorResponse('Account already exists for this email', 400));

  const hash = await bcrypt.hash(password, 10);
  const author = await AuthorUser.create({ event: eventId, name, email, mobile, passwordHash: hash });

  // TODO: send verification email (out of scope for first iteration)

  // Send author sign-up confirmation email if template and email settings exist
  try {
    let tpl = event.emailSettings?.templates?.authorSignup;
    if (!tpl) {
      tpl = {
        subject: 'Welcome to the {{eventName}} Abstract Portal',
        body: 'Dear {{firstName}},\n\nThank you for creating an Author account for {{eventName}}. You can now submit and manage your abstracts through the portal.\n\nRegards,\nThe Organizing Team'
      };
    }
    if (event.emailSettings?.enabled) {
      const firstName = name.split(' ')[0] || name;
      const subject = (tpl.subject || '')
        .replace(/{{firstName}}/g, firstName)
        .replace(/{{eventName}}/g, event.name);
      let bodyHtml = (tpl.body || '')
        .replace(/{{firstName}}/g, firstName)
        .replace(/{{eventName}}/g, event.name);

      await sendEmail({
        to: email,
        subject,
        html: bodyHtml,
        fromName: event.emailSettings.senderName || 'Event Organizer',
        fromEmail: event.emailSettings.senderEmail || 'noreply@example.com',
        smtp: {
          host: event.emailSettings.smtpHost,
          port: event.emailSettings.smtpPort,
          secure: event.emailSettings.smtpSecure,
          auth: {
            user: event.emailSettings.smtpUser,
            pass: event.emailSettings.smtpPassword
          }
        }
      });
      logger.info(`[authorAuth] Sign-up email sent to ${email}`);
    }
  } catch (emailErr) {
    logger.error(`[authorAuth] Failed to send sign-up email to ${email}: ${emailErr.message}`);
  }

  const token = signJwt(author);
  res.status(201).json({ success: true, data: { id: author._id, name: author.name, email: author.email }, token });
}));

// POST /api/author-auth/login
router.post('/login', asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return next(new ErrorResponse('Email and password required', 400));
  const author = await AuthorUser.findOne({ email });
  if (!author) return next(new ErrorResponse('Invalid credentials', 401));
  const ok = await author.checkPassword(password);
  if (!ok) return next(new ErrorResponse('Invalid credentials', 401));
  const token = signJwt(author);
  res.json({ success: true, data: { id: author._id, name: author.name, email: author.email }, token });
}));

module.exports = router; 