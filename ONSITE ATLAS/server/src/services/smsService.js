const axios = require('axios');
const logger = require('../config/logger');

class SMSService {
  constructor() {
    // Support multiple SMS providers
    this.provider = process.env.SMS_PROVIDER || 'twilio'; // twilio, textlocal, msg91, etc.
    this.enabled = process.env.SMS_ENABLED === 'true';
    
    // Twilio configuration
    this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioFromNumber = process.env.TWILIO_FROM_NUMBER;
    
    // TextLocal configuration
    this.textlocalApiKey = process.env.TEXTLOCAL_API_KEY;
    this.textlocalUsername = process.env.TEXTLOCAL_USERNAME;
    this.textlocalSender = process.env.TEXTLOCAL_SENDER || 'EVENT';
    
    // MSG91 configuration
    this.msg91ApiKey = process.env.MSG91_API_KEY;
    this.msg91SenderId = process.env.MSG91_SENDER_ID || 'EVENT';
    this.msg91Route = process.env.MSG91_ROUTE || '4';
  }

  /**
   * Send SMS message
   */
  async sendMessage(phoneNumber, message, templateId = null) {
    if (!this.enabled) {
      logger.warn('SMS service is disabled');
      return { success: false, message: 'SMS service is disabled' };
    }

    try {
      // Clean phone number
      const cleanPhone = this.cleanPhoneNumber(phoneNumber);
      
      if (!cleanPhone) {
        throw new Error('Invalid phone number format');
      }

      let result;
      
      switch (this.provider.toLowerCase()) {
        case 'twilio':
          result = await this.sendViaTwilio(cleanPhone, message);
          break;
        case 'textlocal':
          result = await this.sendViaTextLocal(cleanPhone, message);
          break;
        case 'msg91':
          result = await this.sendViaMSG91(cleanPhone, message, templateId);
          break;
        default:
          throw new Error(`Unsupported SMS provider: ${this.provider}`);
      }

      logger.info(`SMS sent successfully to ${cleanPhone}`, {
        provider: this.provider,
        messageId: result.messageId
      });

      return {
        success: true,
        message: 'SMS sent successfully',
        data: {
          messageId: result.messageId,
          phoneNumber: cleanPhone,
          provider: this.provider
        }
      };

    } catch (error) {
      logger.error('SMS sending failed:', {
        error: error.message,
        phoneNumber: phoneNumber,
        provider: this.provider,
        stack: error.stack
      });

      return {
        success: false,
        message: `Failed to send SMS: ${error.message}`,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Send SMS via Twilio
   */
  async sendViaTwilio(phoneNumber, message) {
    if (!this.twilioAccountSid || !this.twilioAuthToken) {
      throw new Error('Twilio credentials not configured');
    }

    const twilio = require('twilio')(this.twilioAccountSid, this.twilioAuthToken);
    
    const result = await twilio.messages.create({
      body: message,
      from: this.twilioFromNumber,
      to: `+${phoneNumber}`
    });

    return {
      messageId: result.sid,
      status: result.status
    };
  }

  /**
   * Send SMS via TextLocal (India)
   */
  async sendViaTextLocal(phoneNumber, message) {
    if (!this.textlocalApiKey) {
      throw new Error('TextLocal API key not configured');
    }

    const params = new URLSearchParams();
    params.append('apikey', this.textlocalApiKey);
    params.append('numbers', phoneNumber);
    params.append('message', message);
    params.append('sender', this.textlocalSender);

    const response = await axios.post('https://api.textlocal.in/send/', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.data.status !== 'success') {
      throw new Error(response.data.errors?.[0]?.message || 'TextLocal API error');
    }

    return {
      messageId: response.data.messages?.[0]?.id,
      status: response.data.status
    };
  }

  /**
   * Send SMS via MSG91 (India)
   */
  async sendViaMSG91(phoneNumber, message, templateId = null) {
    if (!this.msg91ApiKey) {
      throw new Error('MSG91 API key not configured');
    }

    const payload = {
      sender: this.msg91SenderId,
      route: this.msg91Route,
      country: '91',
      sms: [
        {
          message: message,
          to: [phoneNumber]
        }
      ]
    };

    if (templateId) {
      payload.template_id = templateId;
    }

    const response = await axios.post('https://api.msg91.com/api/v5/flow/', payload, {
      headers: {
        'authkey': this.msg91ApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.type !== 'success') {
      throw new Error(response.data.message || 'MSG91 API error');
    }

    return {
      messageId: response.data.data?.[0]?.messageId,
      status: response.data.type
    };
  }

  /**
   * Send payment link via SMS
   */
  async sendPaymentLink(phoneNumber, registrationData, paymentLink) {
    const message = this.formatPaymentLinkMessage(registrationData, paymentLink);
    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Send registration confirmation via SMS
   */
  async sendRegistrationConfirmation(phoneNumber, registrationData) {
    const message = this.formatRegistrationConfirmationMessage(registrationData);
    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Send event reminder via SMS
   */
  async sendEventReminder(phoneNumber, eventData, registrationData) {
    const message = this.formatEventReminderMessage(eventData, registrationData);
    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Send OTP via SMS
   */
  async sendOTP(phoneNumber, otp, expiryMinutes = 10) {
    const message = `Your OTP for event registration is: ${otp}. Valid for ${expiryMinutes} minutes. Do not share this code with anyone.`;
    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkMessages(recipients, messageTemplate, templateData = {}) {
    const results = [];
    const batchSize = 10; // Process in batches to avoid overwhelming the API
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchPromises = batch.map(async (recipient) => {
        try {
          const personalizedMessage = this.personalizeMessage(messageTemplate, {
            ...templateData,
            ...recipient
          });
          
          const result = await this.sendMessage(recipient.phoneNumber, personalizedMessage);
          
          return {
            phoneNumber: recipient.phoneNumber,
            registrationId: recipient.registrationId,
            ...result
          };
          
        } catch (error) {
          return {
            phoneNumber: recipient.phoneNumber,
            registrationId: recipient.registrationId,
            success: false,
            message: `Failed to send: ${error.message}`
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(r => r.value || r.reason));

      // Add delay between batches to respect rate limits
      if (i + batchSize < recipients.length) {
        await this.delay(2000);
      }
    }

    return results;
  }

  /**
   * Clean and format phone number
   */
  cleanPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    
    // Remove all non-digits
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming India +91 as default)
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      // Already has country code
    } else if (cleaned.length > 12) {
      // Remove extra digits from the beginning
      cleaned = cleaned.slice(-12);
    }
    
    return cleaned.length >= 10 ? cleaned : null;
  }

  /**
   * Format payment link message
   */
  formatPaymentLinkMessage(registrationData, paymentLink) {
    return `Payment reminder for ${registrationData.event?.name}. Registration ID: ${registrationData.registrationId}. Amount: ₹${registrationData.amountCents / 100}. Pay now: ${paymentLink}. Complete within 24 hours.`;
  }

  /**
   * Format registration confirmation message
   */
  formatRegistrationConfirmationMessage(registrationData) {
    return `Registration confirmed for ${registrationData.event?.name}! Your ID: ${registrationData.registrationId}. Date: ${new Date(registrationData.event?.startDate).toLocaleDateString()}. Bring valid ID on event day.`;
  }

  /**
   * Format event reminder message
   */
  formatEventReminderMessage(eventData, registrationData) {
    const eventDate = new Date(eventData.startDate);
    const isToday = eventDate.toDateString() === new Date().toDateString();
    const isTomorrow = eventDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
    
    let timeFrame = eventDate.toLocaleDateString();
    if (isToday) timeFrame = 'TODAY';
    else if (isTomorrow) timeFrame = 'TOMORROW';

    return `Event reminder: ${eventData.name} is ${timeFrame} at ${eventDate.toLocaleTimeString()}. Your registration: ${registrationData.registrationId}. Arrive 30 min early with photo ID.`;
  }

  /**
   * Personalize message with template variables
   */
  personalizeMessage(template, data) {
    let message = template;
    
    // Replace template variables like {{firstName}}, {{registrationId}}
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      message = message.replace(regex, data[key] || '');
    });
    
    return message;
  }

  /**
   * Add delay for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get SMS delivery status
   */
  async getDeliveryStatus(messageId) {
    try {
      switch (this.provider.toLowerCase()) {
        case 'twilio':
          return await this.getTwilioStatus(messageId);
        case 'textlocal':
          return await this.getTextLocalStatus(messageId);
        case 'msg91':
          return await this.getMSG91Status(messageId);
        default:
          return { status: 'unknown', message: 'Status check not supported for this provider' };
      }
    } catch (error) {
      logger.error('Error getting SMS delivery status:', error);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Validate SMS service configuration
   */
  validateConfiguration() {
    const issues = [];
    
    if (!this.enabled) {
      issues.push('SMS service is disabled');
      return { isValid: false, issues };
    }
    
    switch (this.provider.toLowerCase()) {
      case 'twilio':
        if (!this.twilioAccountSid) issues.push('Twilio Account SID is required');
        if (!this.twilioAuthToken) issues.push('Twilio Auth Token is required');
        if (!this.twilioFromNumber) issues.push('Twilio From Number is required');
        break;
      case 'textlocal':
        if (!this.textlocalApiKey) issues.push('TextLocal API Key is required');
        break;
      case 'msg91':
        if (!this.msg91ApiKey) issues.push('MSG91 API Key is required');
        break;
      default:
        issues.push(`Unsupported SMS provider: ${this.provider}`);
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Get account balance/credits
   */
  async getAccountBalance() {
    try {
      switch (this.provider.toLowerCase()) {
        case 'textlocal':
          const response = await axios.get(`https://api.textlocal.in/balance/?apikey=${this.textlocalApiKey}`);
          return { balance: response.data.balance?.sms || 0, currency: 'credits' };
        case 'msg91':
          const msg91Response = await axios.get(`https://api.msg91.com/api/v5/user/getBalance/${this.msg91ApiKey}`);
          return { balance: msg91Response.data.USER_PLAN?.SMS || 0, currency: 'credits' };
        default:
          return { balance: 'unknown', currency: 'unknown' };
      }
    } catch (error) {
      logger.error('Error getting SMS account balance:', error);
      return { balance: 'error', currency: 'error', message: error.message };
    }
  }
}

module.exports = new SMSService(); 