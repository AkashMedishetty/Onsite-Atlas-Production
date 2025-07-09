const axios = require('axios');
const logger = require('../config/logger');

class WhatsAppService {
  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL || 'https://api.whatsapp.com/send';
    this.businessApiUrl = process.env.WHATSAPP_BUSINESS_API_URL;
    this.apiToken = process.env.WHATSAPP_API_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.enabled = process.env.WHATSAPP_ENABLED === 'true';
  }

  /**
   * Send WhatsApp message via Business API
   */
  async sendMessage(phoneNumber, message, messageType = 'text') {
    if (!this.enabled) {
      logger.warn('WhatsApp service is disabled');
      return { success: false, message: 'WhatsApp service is disabled' };
    }

    try {
      // Clean phone number (remove non-digits and add country code if needed)
      const cleanPhone = this.cleanPhoneNumber(phoneNumber);
      
      if (!cleanPhone) {
        throw new Error('Invalid phone number format');
      }

      // For development/testing - use WhatsApp Web URL
      if (!this.businessApiUrl) {
        const whatsappUrl = `${this.apiUrl}?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
        return {
          success: true,
          message: 'WhatsApp message prepared',
          data: {
            whatsappUrl,
            phoneNumber: cleanPhone,
            messageText: message
          }
        };
      }

      // Use Business API for production
      const payload = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: messageType,
        text: {
          body: message
        }
      };

      const response = await axios.post(
        `${this.businessApiUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`WhatsApp message sent successfully to ${cleanPhone}`, {
        messageId: response.data.messages?.[0]?.id,
        phoneNumber: cleanPhone
      });

      return {
        success: true,
        message: 'WhatsApp message sent successfully',
        data: {
          messageId: response.data.messages?.[0]?.id,
          phoneNumber: cleanPhone
        }
      };

    } catch (error) {
      logger.error('WhatsApp message sending failed:', {
        error: error.message,
        phoneNumber: phoneNumber,
        stack: error.stack
      });

      return {
        success: false,
        message: `Failed to send WhatsApp message: ${error.message}`,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Send payment link via WhatsApp
   */
  async sendPaymentLink(phoneNumber, registrationData, paymentLink) {
    const message = this.formatPaymentLinkMessage(registrationData, paymentLink);
    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Send registration confirmation via WhatsApp
   */
  async sendRegistrationConfirmation(phoneNumber, registrationData) {
    const message = this.formatRegistrationConfirmationMessage(registrationData);
    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Send event reminder via WhatsApp
   */
  async sendEventReminder(phoneNumber, eventData, registrationData) {
    const message = this.formatEventReminderMessage(eventData, registrationData);
    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Send bulk WhatsApp messages
   */
  async sendBulkMessages(recipients, messageTemplate, templateData = {}) {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const personalizedMessage = this.personalizeMessage(messageTemplate, {
          ...templateData,
          ...recipient
        });
        
        const result = await this.sendMessage(recipient.phoneNumber, personalizedMessage);
        
        results.push({
          phoneNumber: recipient.phoneNumber,
          registrationId: recipient.registrationId,
          ...result
        });

        // Add delay between messages to avoid rate limiting
        await this.delay(1000);
        
      } catch (error) {
        results.push({
          phoneNumber: recipient.phoneNumber,
          registrationId: recipient.registrationId,
          success: false,
          message: `Failed to send: ${error.message}`
        });
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
    return `
🎫 *Payment Reminder - ${registrationData.event?.name}*

Dear ${registrationData.personalInfo?.firstName},

Your registration is confirmed! Please complete your payment to secure your spot.

📝 *Registration ID:* ${registrationData.registrationId}
💰 *Amount:* ₹${registrationData.amountCents / 100}
🏷️ *Category:* ${registrationData.category?.name}

💳 *Pay Now:* ${paymentLink}

⏰ Please complete payment within 24 hours to avoid cancellation.

Thank you!
${registrationData.event?.name} Team
    `.trim();
  }

  /**
   * Format registration confirmation message
   */
  formatRegistrationConfirmationMessage(registrationData) {
    return `
🎉 *Registration Confirmed!*

Dear ${registrationData.personalInfo?.firstName},

Welcome to ${registrationData.event?.name}!

📝 *Registration ID:* ${registrationData.registrationId}
🏷️ *Category:* ${registrationData.category?.name}
📅 *Event Date:* ${new Date(registrationData.event?.startDate).toLocaleDateString()}
📍 *Venue:* ${registrationData.event?.venue || 'TBA'}

💡 *Next Steps:*
• Save this WhatsApp message for reference
• Bring a valid ID on event day
• Check-in starts 1 hour before the event

See you there!
${registrationData.event?.name} Team
    `.trim();
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

    return `
⏰ *Event Reminder - ${timeFrame}*

Dear ${registrationData.personalInfo?.firstName},

${eventData.name} is ${timeFrame}!

📅 *Date:* ${eventDate.toLocaleDateString()}
⏰ *Time:* ${eventDate.toLocaleTimeString()}
📍 *Venue:* ${eventData.venue || 'Check your email for venue details'}
🆔 *Your Registration:* ${registrationData.registrationId}

🚨 *Important:*
• Arrive 30 minutes early for check-in
• Bring valid photo ID
• Check your email for any last-minute updates

Looking forward to seeing you!
${eventData.name} Team
    `.trim();
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
   * Validate WhatsApp service configuration
   */
  validateConfiguration() {
    const issues = [];
    
    if (!this.enabled) {
      issues.push('WhatsApp service is disabled');
    }
    
    if (this.businessApiUrl && !this.apiToken) {
      issues.push('WhatsApp API token is required when using Business API');
    }
    
    if (this.businessApiUrl && !this.phoneNumberId) {
      issues.push('WhatsApp phone number ID is required when using Business API');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

module.exports = new WhatsAppService(); 