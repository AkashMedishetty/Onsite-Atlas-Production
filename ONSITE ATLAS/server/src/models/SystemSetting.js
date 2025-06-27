const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema({
  siteName: { type: String, default: 'Onsite Atlas' },
  adminEmail: { type: String, default: 'admin@example.com' },
  timezone: { type: String, default: 'UTC' },
  dateFormat: { type: String, default: 'MM/DD/YYYY' },
  timeFormat: { type: String, default: '12h' },
  defaultLanguage: { type: String, default: 'en' },
  logoUrl: String,
  faviconUrl: String,

  // Registration section
  registration: {
    enablePublicRegistration: { type: Boolean, default: true },
    requireEmailVerification: { type: Boolean, default: true },
    allowSelfRegistration: { type: Boolean, default: false },
    defaultRegistrationPrefix: { type: String, default: 'REG' },
    autoGenerateQRCodes: { type: Boolean, default: true },
    qrCodeFormat: { type: String, default: 'svg' },
    registerConfirmEmailTemplate: { type: String, default: 'registration_confirmation' },
    registerThankYouMessage: { type: String, default: 'Thank you for registering!' }
  },

  // Notification section
  notification: {
    enableEmailNotifications: { type: Boolean, default: true },
    enableSMSNotifications: { type: Boolean, default: false },
    emailProvider: { type: String, default: 'smtp' },
    smsProvider: { type: String, default: 'none' },
    adminNotificationEmail: { type: String, default: 'admin@example.com' },
    fromEmail: { type: String, default: 'no-reply@example.com' },
    emailFooter: { type: String, default: '© Onsite Atlas. All rights reserved.' }
  },

  // Security section
  security: {
    sessionTimeout: { type: Number, default: 60 },
    maxLoginAttempts: { type: Number, default: 5 },
    passwordMinLength: { type: Number, default: 8 },
    passwordRequireNumbers: { type: Boolean, default: true },
    passwordRequireSymbols: { type: Boolean, default: true },
    passwordRequireUppercase: { type: Boolean, default: true },
    passwordExpiryDays: { type: Number, default: 90 },
    enableTwoFactorAuth: { type: Boolean, default: false },
    enableReCaptcha: { type: Boolean, default: false },
    reCaptchaSiteKey: String
  }
}, { timestamps: true });

module.exports = mongoose.model('SystemSetting', systemSettingSchema); 