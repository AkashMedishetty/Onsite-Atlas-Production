const emailService = require('./emailService');
const smsService = require('./smsService');
const whatsappService = require('./whatsappService');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Abstract = require('../models/Abstract');
const Announcement = require('../models/Announcement');
const logger = require('../utils/logger');

/**
 * Unified Notification Service
 * Handles all notifications (email, SMS, WhatsApp) with workflow automation
 */
class NotificationService {
  constructor() {
    this.channels = {
      email: emailService,
      sms: smsService,
      whatsapp: whatsappService
    };
    
    // Notification workflows
    this.workflows = {
      'registration.confirmed': [
        { channel: 'email', template: 'registration_confirmation', delay: 0 },
        { channel: 'sms', template: 'registration_sms', delay: 300000 } // 5 min delay
      ],
      'payment.received': [
        { channel: 'email', template: 'payment_confirmation', delay: 0 },
        { channel: 'whatsapp', template: 'payment_receipt', delay: 600000 } // 10 min delay
      ],
      'abstract.submitted': [
        { channel: 'email', template: 'abstract_confirmation', delay: 0 }
      ],
      'abstract.review_assigned': [
        { channel: 'email', template: 'review_assignment', delay: 0 },
        { channel: 'email', template: 'review_reminder', delay: 172800000 } // 2 days
      ],
      'event.reminder': [
        { channel: 'email', template: 'event_reminder', delay: 0 },
        { channel: 'sms', template: 'event_reminder_sms', delay: 300000 },
        { channel: 'whatsapp', template: 'event_reminder_wa', delay: 600000 }
      ],
      'certificate.ready': [
        { channel: 'email', template: 'certificate_ready', delay: 0 }
      ]
    };
  }

  /**
   * Send immediate notification
   * @param {String} channel - Communication channel (email, sms, whatsapp)
   * @param {String} type - Notification type
   * @param {String} eventId - Event ID
   * @param {Array|String} recipients - Recipient IDs or contact info
   * @param {Object} templateData - Data for template processing
   * @param {Object} options - Additional options
   */
  async sendNotification(channel, type, eventId, recipients, templateData = {}, options = {}) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error(`Event ${eventId} not found`);
      }

      const service = this.channels[channel];
      if (!service) {
        throw new Error(`Unsupported notification channel: ${channel}`);
      }

      const recipientList = Array.isArray(recipients) ? recipients : [recipients];
      const results = [];

      for (const recipient of recipientList) {
        try {
          let result;
          
          switch (channel) {
            case 'email':
              result = await this.sendEmailNotification(type, event, recipient, templateData, options);
              break;
            case 'sms':
              result = await this.sendSMSNotification(type, event, recipient, templateData, options);
              break;
            case 'whatsapp':
              result = await this.sendWhatsAppNotification(type, event, recipient, templateData, options);
              break;
          }
          
          results.push({ recipient, success: true, result });
          
        } catch (error) {
          logger.error(`Failed to send ${channel} notification to ${recipient}:`, error);
          results.push({ recipient, success: false, error: error.message });
        }
      }

      return {
        channel,
        type,
        eventId,
        results,
        summary: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      };

    } catch (error) {
      logger.error('Error in sendNotification:', error);
      throw error;
    }
  }

  /**
   * Trigger notification workflow
   * @param {String} workflowType - Type of workflow (e.g., 'registration.confirmed')
   * @param {String} eventId - Event ID
   * @param {String} triggerId - ID that triggered the workflow (registration, payment, etc.)
   * @param {Object} data - Additional data for template processing
   */
  async triggerWorkflow(workflowType, eventId, triggerId, data = {}) {
    try {
      const workflow = this.workflows[workflowType];
      if (!workflow) {
        logger.warn(`Unknown workflow type: ${workflowType}`);
        return;
      }

      logger.info(`Triggering workflow ${workflowType} for event ${eventId}, trigger ${triggerId}`);

      // Get trigger context data
      const contextData = await this.getWorkflowContext(workflowType, triggerId, eventId);
      const templateData = { ...contextData, ...data };

      const workflowResults = [];

      for (const step of workflow) {
        try {
          if (step.delay > 0) {
            // Schedule delayed notification
            await this.scheduleNotification(
              step.channel,
              step.template,
              eventId,
              contextData.recipients,
              templateData,
              new Date(Date.now() + step.delay)
            );
            workflowResults.push({ 
              step: step.template, 
              scheduled: true, 
              delay: step.delay 
            });
          } else {
            // Send immediate notification
            const result = await this.sendNotification(
              step.channel,
              step.template,
              eventId,
              contextData.recipients,
              templateData
            );
            workflowResults.push({ 
              step: step.template, 
              immediate: true, 
              result 
            });
          }
        } catch (error) {
          logger.error(`Error in workflow step ${step.template}:`, stepError);
          workflowResults.push({ 
            step: step.template, 
            error: stepError.message 
          });
        }
      }

      return {
        workflowType,
        eventId,
        triggerId,
        steps: workflowResults
      };

    } catch (error) {
      logger.error('Error triggering workflow:', error);
      throw error;
    }
  }

  /**
   * Schedule future notification
   * @param {String} channel - Communication channel
   * @param {String} type - Notification type
   * @param {String} eventId - Event ID
   * @param {Array} recipients - Recipients
   * @param {Object} templateData - Template data
   * @param {Date} scheduledDate - When to send
   */
  async scheduleNotification(channel, type, eventId, recipients, templateData, scheduledDate) {
    try {
      // Create scheduled notification record
      const ScheduledNotification = require('../models/ScheduledNotification');
      
      const scheduled = await ScheduledNotification.create({
        channel,
        type,
        event: eventId,
        recipients,
        templateData,
        scheduledDate,
        status: 'pending'
      });

      logger.info(`Scheduled ${channel} notification ${type} for ${scheduledDate}`);
      return scheduled;

    } catch (error) {
      logger.error('Error scheduling notification:', error);
      throw error;
    }
  }

  /**
   * Process scheduled notifications (to be called by cron job)
   */
  async processScheduledNotifications() {
    try {
      const ScheduledNotification = require('../models/ScheduledNotification');
      
      const dueNotifications = await ScheduledNotification.find({
        status: 'pending',
        scheduledDate: { $lte: new Date() }
      });

      logger.info(`Processing ${dueNotifications.length} scheduled notifications`);

      for (const notification of dueNotifications) {
        try {
          await this.sendNotification(
            notification.channel,
            notification.type,
            notification.event,
            notification.recipients,
            notification.templateData
          );

          notification.status = 'sent';
          notification.sentAt = new Date();
          await notification.save();

        } catch (error) {
          notification.status = 'failed';
          notification.error = error.message;
          notification.failedAt = new Date();
          await notification.save();
          
          logger.error(`Failed to send scheduled notification ${notification._id}:`, error);
        }
      }

    } catch (error) {
      logger.error('Error processing scheduled notifications:', error);
    }
  }

  /**
   * Get workflow context data
   * @param {String} workflowType - Workflow type
   * @param {String} triggerId - Trigger ID
   * @param {String} eventId - Event ID
   */
  async getWorkflowContext(workflowType, triggerId, eventId) {
    const context = { recipients: [] };

    try {
      switch (workflowType) {
        case 'registration.confirmed':
        case 'payment.received':
        case 'certificate.ready':
          const registration = await Registration.findById(triggerId)
            .populate('event', 'name startDate endDate')
            .populate('category', 'name');
          
          if (registration) {
            context.recipients = [registration.personalInfo?.email];
            context.participantName = `${registration.personalInfo?.firstName} ${registration.personalInfo?.lastName}`;
            context.eventName = registration.event?.name;
            context.registrationId = registration.registrationId;
            context.categoryName = registration.category?.name;
          }
          break;

        case 'abstract.submitted':
        case 'abstract.review_assigned':
          const abstract = await Abstract.findById(triggerId)
            .populate('registration')
            .populate('event', 'name');
          
          if (abstract) {
            if (workflowType === 'abstract.submitted') {
              context.recipients = [abstract.registration?.personalInfo?.email];
              context.authorName = abstract.authors;
            } else {
              // For review assignment, notify reviewers
              const reviewers = await this.getAbstractReviewers(abstract.event._id);
              context.recipients = reviewers.map(r => r.email);
            }
            context.abstractTitle = abstract.title;
            context.eventName = abstract.event?.name;
          }
          break;

        case 'event.reminder':
          // Get all confirmed registrations for the event
          const registrations = await Registration.find({
            event: eventId,
            status: 'confirmed'
          });
          
          context.recipients = registrations
            .map(r => r.personalInfo?.email)
            .filter(email => email);
          
          const event = await Event.findById(eventId);
          context.eventName = event?.name;
          context.eventDate = event?.startDate;
          break;
      }

      return context;

    } catch (error) {
      logger.error('Error getting workflow context:', error);
      return { recipients: [] };
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(type, event, recipient, templateData, options) {
    const template = event.emailSettings?.templates?.[type];
    if (!template) {
      throw new Error(`Email template ${type} not found for event ${event._id}`);
    }

    return await emailService.sendEmail({
      to: recipient,
      subject: this.processTemplate(template.subject, templateData),
      html: this.processTemplate(template.body, templateData),
      eventId: event._id.toString()
    });
  }

  /**
   * Send SMS notification
   */
  async sendSMSNotification(type, event, recipient, templateData, options) {
    const template = event.smsSettings?.templates?.[type];
    if (!template) {
      throw new Error(`SMS template ${type} not found for event ${event._id}`);
    }

    return await smsService.sendMessage(
      recipient,
      this.processTemplate(template.message, templateData)
    );
  }

  /**
   * Send WhatsApp notification
   */
  async sendWhatsAppNotification(type, event, recipient, templateData, options) {
    const template = event.whatsappSettings?.templates?.[type];
    if (!template) {
      throw new Error(`WhatsApp template ${type} not found for event ${event._id}`);
    }

    return await whatsappService.sendMessage(
      recipient,
      this.processTemplate(template.message, templateData)
    );
  }

  /**
   * Process template with data
   */
  processTemplate(template, data) {
    if (!template) return '';
    
    let processed = template;
    
    // Replace template variables like {{key}}
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, data[key] || '');
    });
    
    return processed;
  }

  /**
   * Get reviewers for abstract workflow
   */
  async getAbstractReviewers(eventId) {
    const User = require('../models/User');
    return await User.find({
      role: { $in: ['admin', 'staff', 'reviewer'] },
      'events': eventId
    });
  }

  /**
   * Create announcement notification
   */
  async createAnnouncement(eventId, announcement, targetAudience = 'all') {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      // Create announcement record
      const announcementDoc = await Announcement.create({
        event: eventId,
        title: announcement.title,
        content: announcement.content,
        targetAudience,
        isActive: true,
        priority: announcement.priority || 0,
        createdBy: announcement.createdBy
      });

      // Send notifications based on target audience
      let recipients = [];
      
      if (targetAudience === 'all' || targetAudience === 'registrants') {
        const registrations = await Registration.find({
          event: eventId,
          status: 'confirmed'
        });
        recipients = registrations.map(r => r.personalInfo?.email).filter(e => e);
      }

      if (recipients.length > 0) {
        await this.sendNotification(
          'email',
          'announcement',
          eventId,
          recipients,
          {
            announcementTitle: announcement.title,
            announcementContent: announcement.content,
            eventName: event.name
          }
        );
      }

      return announcementDoc;

    } catch (error) {
      logger.error('Error creating announcement:', error);
      throw error;
    }
  }

}

module.exports = new NotificationService(); 