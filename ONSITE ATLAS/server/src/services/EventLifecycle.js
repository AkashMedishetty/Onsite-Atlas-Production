const Event = require('../models/Event');
const NotificationWorkflow = require('../models/NotificationWorkflow');
const Registration = require('../models/Registration');
const NotificationService = require('./NotificationService');
const logger = require('../utils/logger');

/**
 * Event Lifecycle Management Service
 * Handles event state transitions, automation, and workflows
 */
class EventLifecycleService {
  constructor() {
    this.states = {
      DRAFT: 'draft',
      REVIEW: 'review',
      PUBLISHED: 'published',
      LIVE: 'live',
      COMPLETED: 'completed',
      ARCHIVED: 'archived',
      CANCELLED: 'cancelled'
    };

    this.transitions = {
      draft: ['review', 'cancelled'],
      review: ['draft', 'published', 'cancelled'],
      published: ['live', 'cancelled'],
      live: ['completed', 'cancelled'],
      completed: ['archived'],
      cancelled: ['archived']
    };

    this.automationRules = {
      autoGoLive: true,
      autoComplete: true,
      autoReminders: true,
      autoCloseRegistration: true
    };
  }

  /**
   * Transition event to new state
   */
  async transitionState(eventId, newState, userId, options = {}) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      const currentState = event.status || this.states.DRAFT;
      
      // Validate transition
      if (!this.isValidTransition(currentState, newState)) {
        throw new Error(`Invalid transition from ${currentState} to ${newState}`);
      }

      // Pre-transition checks
      await this.performPreTransitionChecks(event, newState);

      // Update event state
      event.status = newState;
      event.statusHistory = event.statusHistory || [];
      event.statusHistory.push({
        from: currentState,
        to: newState,
        timestamp: new Date(),
        userId,
        reason: options.reason,
        metadata: options.metadata
      });

      await event.save();

      // Post-transition actions
      await this.performPostTransitionActions(event, currentState, newState, userId);

      return event;
    } catch (error) {
      logger.error('Failed to transition event state:', error);
      throw error;
    }
  }

  /**
   * Check if state transition is valid
   */
  isValidTransition(currentState, newState) {
    const allowedTransitions = this.transitions[currentState];
    return allowedTransitions && allowedTransitions.includes(newState);
  }

  /**
   * Perform checks before state transition
   */
  async performPreTransitionChecks(event, newState) {
    switch (newState) {
      case this.states.PUBLISHED:
        if (!event.name || !event.startDate || !event.endDate) {
          throw new Error('Event must have name, start date, and end date before publishing');
        }
        break;

      case this.states.LIVE:
        if (new Date() < new Date(event.startDate)) {
          throw new Error('Cannot set event to live before start date');
        }
        break;

      case this.states.COMPLETED:
        if (new Date() < new Date(event.endDate)) {
          throw new Error('Cannot complete event before end date');
        }
        break;
    }
  }

  /**
   * Perform actions after state transition
   */
  async performPostTransitionActions(event, fromState, toState, userId) {
    try {
      switch (toState) {
        case this.states.PUBLISHED:
          await this.onEventPublished(event, userId);
          break;

        case this.states.LIVE:
          await this.onEventStarted(event, userId);
          break;

        case this.states.COMPLETED:
          await this.onEventCompleted(event, userId);
          break;

        case this.states.CANCELLED:
          await this.onEventCancelled(event, userId);
          break;
      }
    } catch (error) {
      logger.error('Error in post-transition actions:', error);
    }
  }

  /**
   * Actions when event is published
   */
  async onEventPublished(event, userId) {
    await this.scheduleEventWorkflows(event);

    await NotificationService.triggerWorkflow(
      'event_published',
      event._id,
      event._id,
      {
        eventName: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        publishedBy: userId
      }
    );

    if (event.registrationSettings?.autoOpen) {
      event.registrationOpen = true;
      await event.save();
    }
  }

  /**
   * Actions when event starts
   */
  async onEventStarted(event, userId) {
    if (event.registrationOpen) {
      event.registrationOpen = false;
      await event.save();
    }

    const registrations = await Registration.find({
      event: event._id,
      status: 'confirmed'
    });

    if (registrations.length > 0) {
      await NotificationService.sendBulkNotifications(
        event._id,
        registrations.map(r => r._id),
        'event_started',
        {
          eventName: event.name,
          startDate: event.startDate
        }
      );
    }
  }

  /**
   * Actions when event is completed
   */
  async onEventCompleted(event, userId) {
    await this.generateEventCompletionReport(event);
    await this.schedulePostEventSurveys(event);

    await NotificationService.triggerWorkflow(
      'event_completed',
      event._id,
      event._id,
      {
        eventName: event.name,
        completedAt: new Date()
      }
    );

    await Registration.updateMany(
      { event: event._id, status: 'confirmed' },
      { status: 'attended' }
    );
  }

  /**
   * Actions when event is cancelled
   */
  async onEventCancelled(event, userId) {
    await NotificationWorkflow.updateMany(
      { eventId: event._id, status: 'active' },
      { status: 'cancelled', cancelledAt: new Date() }
    );

    const registrations = await Registration.find({
      event: event._id,
      status: { $in: ['confirmed', 'pending'] }
    });

    if (registrations.length > 0) {
      await NotificationService.sendBulkNotifications(
        event._id,
        registrations.map(r => r._id),
        'event_cancelled',
        {
          eventName: event.name,
          cancellationReason: event.statusHistory?.slice(-1)[0]?.reason
        }
      );
    }
  }

  /**
   * Schedule automated workflows for event
   */
  async scheduleEventWorkflows(event) {
    const workflows = [
      {
        type: 'event_reminder',
        delay: this.calculateDelay(event.startDate, -1), // 1 day before
        condition: () => true
      },
      {
        type: 'auto_go_live',
        delay: this.calculateDelay(event.startDate, 0),
        condition: () => this.automationRules.autoGoLive
      },
      {
        type: 'auto_complete',
        delay: this.calculateDelay(event.endDate, 1), // 1 day after end
        condition: () => this.automationRules.autoComplete
      }
    ];

    for (const workflow of workflows) {
      if (workflow.condition() && workflow.delay > 0) {
        await this.scheduleWorkflow(event, workflow);
      }
    }
  }

  /**
   * Calculate delay for scheduling
   */
  calculateDelay(targetDate, offsetDays) {
    if (!targetDate) return 0;
    
    const target = new Date(targetDate);
    target.setDate(target.getDate() + offsetDays);
    
    const now = new Date();
    const delay = target.getTime() - now.getTime();
    
    return Math.max(delay, 0);
  }

  /**
   * Schedule a workflow
   */
  async scheduleWorkflow(event, workflow) {
    await NotificationWorkflow.createWorkflowFromTemplate(
      workflow.type,
      event._id,
      event._id,
      'Event',
      event.createdBy,
      {
        scheduledDate: new Date(Date.now() + workflow.delay),
        automated: true
      }
    );
  }

  /**
   * Process automated state transitions
   */
  async processAutomatedTransitions() {
    try {
      const now = new Date();

      // Auto go-live events
      if (this.automationRules.autoGoLive) {
        const eventsToGoLive = await Event.find({
          status: this.states.PUBLISHED,
          startDate: { $lte: now }
        });

        for (const event of eventsToGoLive) {
          await this.transitionState(event._id, this.states.LIVE, null, {
            reason: 'Automated transition - event start time reached'
          });
        }
      }

      // Auto complete events
      if (this.automationRules.autoComplete) {
        const eventsToComplete = await Event.find({
          status: this.states.LIVE,
          endDate: { $lt: now }
        });

        for (const event of eventsToComplete) {
          await this.transitionState(event._id, this.states.COMPLETED, null, {
            reason: 'Automated transition - event end time passed'
          });
        }
      }

    } catch (error) {
      logger.error('Error processing automated transitions:', error);
    }
  }

  /**
   * Generate event completion report
   */
  async generateEventCompletionReport(event) {
    try {
      const registrations = await Registration.find({ event: event._id });
      const totalRegistrations = registrations.length;
      const confirmedRegistrations = registrations.filter(r => r.status === 'confirmed').length;

      const report = {
        eventId: event._id,
        eventName: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        completedAt: new Date(),
        statistics: {
          totalRegistrations,
          confirmedRegistrations,
          attendanceRate: totalRegistrations > 0 ? confirmedRegistrations / totalRegistrations : 0
        }
      };

      logger.info('Event completion report generated:', report);
      return report;
    } catch (error) {
      logger.error('Error generating completion report:', error);
      throw error;
    }
  }

  /**
   * Schedule post-event surveys
   */
  async schedulePostEventSurveys(event) {
    await NotificationWorkflow.createWorkflowFromTemplate(
      'post_event_survey',
      event._id,
      event._id,
      'Event',
      null,
      {
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day delay
        automated: true
      }
    );
  }
}

module.exports = new EventLifecycleService();
