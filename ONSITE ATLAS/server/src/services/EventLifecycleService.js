const Event = require('../models/Event');
const Registration = require('../models/Registration');
const NotificationService = require('./NotificationService');
const logger = require('../utils/logger');

/**
 * Event Lifecycle Automation Service
 * Handles automated event state transitions and capacity management
 */
class EventLifecycleService {
  constructor() {
    this.automationRules = {
      'auto_open_registration': {
        from: 'active',
        to: 'registration_open',
        condition: 'registration_start_date_reached'
      },
      'auto_close_registration': {
        from: 'registration_open',
        to: 'registration_closed',
        condition: 'registration_end_date_reached'
      },
      'auto_mark_full': {
        from: 'registration_open',
        to: 'full',
        condition: 'capacity_reached'
      }
    };
  }

  /**
   * Process all events for lifecycle automation
   */
  async processEventLifecycle() {
    try {
      logger.info('Starting event lifecycle automation process');

      const events = await Event.find({
        status: { 
          $in: ['active', 'registration_open', 'registration_closed', 
                'abstract_submission_open', 'abstract_submission_closed',
                'review_in_progress', 'review_completed', 'event_started',
                'event_in_progress', 'full']
        }
      });

      const results = { processed: 0, transitions: 0, errors: 0 };

      for (const event of events) {
        try {
          const transitionResult = await this.processEventTransitions(event);
          results.processed++;
          results.transitions += transitionResult.transitions;
        } catch (error) {
          logger.error(`Error processing event ${event._id}:`, error);
          results.errors++;
        }
      }

      logger.info('Event lifecycle automation completed:', results);
      return results;

    } catch (error) {
      logger.error('Error in event lifecycle automation:', error);
      throw error;
    }
  }

  /**
   * Process state transitions for a specific event
   */
  async processEventTransitions(event) {
    const results = { eventId: event._id, transitions: 0 };

    for (const [ruleName, rule] of Object.entries(this.automationRules)) {
      if (event.status === rule.from) {
        const shouldTransition = await this.evaluateCondition(event, rule.condition);
        
        if (shouldTransition) {
          const transitioned = await this.transitionEventState(event, rule.to, `Automated: ${ruleName}`);
          if (transitioned) {
            results.transitions++;
            event.status = rule.to;
          }
        }
      }
    }

    return results;
  }

  /**
   * Evaluate transition condition
   */
  async evaluateCondition(event, condition) {
    const now = new Date();

    switch (condition) {
      case 'registration_start_date_reached':
        return event.registrationDates?.startDate && 
               new Date(event.registrationDates.startDate) <= now;

      case 'registration_end_date_reached':
        return event.registrationDates?.endDate && 
               new Date(event.registrationDates.endDate) <= now;

      case 'capacity_reached':
        if (!event.registrationSettings?.maxRegistrations) return false;
        const confirmedCount = await Registration.countDocuments({
          event: event._id,
          status: 'confirmed'
        });
        return confirmedCount >= event.registrationSettings.maxRegistrations;

      default:
        return false;
    }
  }

  /**
   * Transition event to new state
   */
  async transitionEventState(event, newStatus, reason = '') {
    try {
      await Event.findByIdAndUpdate(event._id, {
        status: newStatus,
        $push: {
          statusHistory: {
            status: newStatus,
            changedAt: new Date(),
            changedBy: 'system',
            reason: reason
          }
        }
      });

      return true;
    } catch (error) {
      logger.error(`Error transitioning event ${event._id}:`, error);
      return false;
    }
  }

}

module.exports = new EventLifecycleService();
