const EventEmitter = require('events');
const Event = require('../models/Event');
const NotificationService = require('./NotificationService');
const EventLifecycleService = require('./EventLifecycleService');

class EventStateMachine extends EventEmitter {
  constructor() {
    super();
    this.states = {
      // Planning phase
      DRAFT: 'draft',
      PLANNING: 'planning',
      APPROVED: 'approved',
      
      // Registration phase
      REGISTRATION_OPEN: 'registration_open',
      REGISTRATION_CLOSING: 'registration_closing',
      REGISTRATION_CLOSED: 'registration_closed',
      
      // Abstract submission phase
      ABSTRACT_SUBMISSION_OPEN: 'abstract_submission_open',
      ABSTRACT_SUBMISSION_CLOSING: 'abstract_submission_closing',
      ABSTRACT_SUBMISSION_CLOSED: 'abstract_submission_closed',
      
      // Review phase
      REVIEW_IN_PROGRESS: 'review_in_progress',
      REVIEW_COMPLETED: 'review_completed',
      
      // Pre-event phase
      SCHEDULE_PUBLISHED: 'schedule_published',
      READY_TO_START: 'ready_to_start',
      
      // Event execution
      IN_PROGRESS: 'in_progress',
      PAUSED: 'paused',
      
      // Post-event
      COMPLETED: 'completed',
      CLOSED: 'closed',
      
      // Special states
      CANCELLED: 'cancelled',
      POSTPONED: 'postponed',
      ARCHIVED: 'archived'
    };
    
    this.transitions = {
      [this.states.DRAFT]: [
        this.states.PLANNING,
        this.states.CANCELLED
      ],
      
      [this.states.PLANNING]: [
        this.states.APPROVED,
        this.states.DRAFT,
        this.states.CANCELLED,
        this.states.POSTPONED
      ],
      
      [this.states.APPROVED]: [
        this.states.REGISTRATION_OPEN,
        this.states.PLANNING,
        this.states.CANCELLED,
        this.states.POSTPONED
      ],
      
      [this.states.REGISTRATION_OPEN]: [
        this.states.REGISTRATION_CLOSING,
        this.states.REGISTRATION_CLOSED,
        this.states.ABSTRACT_SUBMISSION_OPEN,
        this.states.CANCELLED,
        this.states.POSTPONED
      ],
      
      [this.states.REGISTRATION_CLOSING]: [
        this.states.REGISTRATION_CLOSED,
        this.states.REGISTRATION_OPEN,
        this.states.CANCELLED,
        this.states.POSTPONED
      ],
      
      [this.states.REGISTRATION_CLOSED]: [
        this.states.ABSTRACT_SUBMISSION_OPEN,
        this.states.REGISTRATION_OPEN,
        this.states.SCHEDULE_PUBLISHED,
        this.states.CANCELLED,
        this.states.POSTPONED
      ],
      
      [this.states.ABSTRACT_SUBMISSION_OPEN]: [
        this.states.ABSTRACT_SUBMISSION_CLOSING,
        this.states.ABSTRACT_SUBMISSION_CLOSED,
        this.states.CANCELLED,
        this.states.POSTPONED
      ],
      
      [this.states.ABSTRACT_SUBMISSION_CLOSING]: [
        this.states.ABSTRACT_SUBMISSION_CLOSED,
        this.states.ABSTRACT_SUBMISSION_OPEN,
        this.states.CANCELLED,
        this.states.POSTPONED
      ],
      
      [this.states.ABSTRACT_SUBMISSION_CLOSED]: [
        this.states.REVIEW_IN_PROGRESS,
        this.states.SCHEDULE_PUBLISHED,
        this.states.CANCELLED,
        this.states.POSTPONED
      ],
      
      [this.states.REVIEW_IN_PROGRESS]: [
        this.states.REVIEW_COMPLETED,
        this.states.CANCELLED,
        this.states.POSTPONED
      ],
      
      [this.states.REVIEW_COMPLETED]: [
        this.states.SCHEDULE_PUBLISHED,
        this.states.CANCELLED,
        this.states.POSTPONED
      ],
      
      [this.states.SCHEDULE_PUBLISHED]: [
        this.states.READY_TO_START,
        this.states.CANCELLED,
        this.states.POSTPONED
      ],
      
      [this.states.READY_TO_START]: [
        this.states.IN_PROGRESS,
        this.states.CANCELLED,
        this.states.POSTPONED
      ],
      
      [this.states.IN_PROGRESS]: [
        this.states.PAUSED,
        this.states.COMPLETED,
        this.states.CANCELLED
      ],
      
      [this.states.PAUSED]: [
        this.states.IN_PROGRESS,
        this.states.COMPLETED,
        this.states.CANCELLED
      ],
      
      [this.states.COMPLETED]: [
        this.states.CLOSED,
        this.states.ARCHIVED
      ],
      
      [this.states.CLOSED]: [
        this.states.ARCHIVED
      ],
      
      // Terminal states
      [this.states.CANCELLED]: [
        this.states.ARCHIVED
      ],
      
      [this.states.POSTPONED]: [
        this.states.PLANNING,
        this.states.CANCELLED,
        this.states.ARCHIVED
      ],
      
      [this.states.ARCHIVED]: []
    };
    
    this.stateRequirements = {
      [this.states.APPROVED]: {
        required: ['title', 'description', 'startDate', 'endDate', 'venue'],
        validations: ['dateConsistency', 'venueAvailability']
      },
      
      [this.states.REGISTRATION_OPEN]: {
        required: ['registrationSettings', 'pricing'],
        validations: ['registrationConfiguration', 'paymentSetup']
      },
      
      [this.states.ABSTRACT_SUBMISSION_OPEN]: {
        required: ['abstractSettings', 'reviewSettings'],
        validations: ['abstractConfiguration', 'reviewerAssignment']
      },
      
      [this.states.SCHEDULE_PUBLISHED]: {
        required: ['agenda', 'sessions'],
        validations: ['scheduleCompleteness', 'roomAssignments']
      },
      
      [this.states.READY_TO_START]: {
        required: ['attendeeList', 'finalSchedule'],
        validations: ['attendeeConfirmation', 'logisticsReady']
      }
    };
    
    this.automaticTransitions = {
      // Auto-transition based on time
      timeBasedTransitions: {
        [this.states.REGISTRATION_OPEN]: {
          to: this.states.REGISTRATION_CLOSING,
          condition: (event) => {
            if (!event.registrationSettings?.earlyWarningDays) return false;
            const warningDate = new Date(event.registrationSettings.deadline);
            warningDate.setDate(warningDate.getDate() - event.registrationSettings.earlyWarningDays);
            return new Date() >= warningDate;
          }
        },
        
        [this.states.REGISTRATION_CLOSING]: {
          to: this.states.REGISTRATION_CLOSED,
          condition: (event) => {
            return new Date() >= new Date(event.registrationSettings?.deadline);
          }
        },
        
        [this.states.ABSTRACT_SUBMISSION_OPEN]: {
          to: this.states.ABSTRACT_SUBMISSION_CLOSING,
          condition: (event) => {
            if (!event.abstractSettings?.earlyWarningDays) return false;
            const warningDate = new Date(event.abstractSettings.deadline);
            warningDate.setDate(warningDate.getDate() - event.abstractSettings.earlyWarningDays);
            return new Date() >= warningDate;
          }
        },
        
        [this.states.ABSTRACT_SUBMISSION_CLOSING]: {
          to: this.states.ABSTRACT_SUBMISSION_CLOSED,
          condition: (event) => {
            return new Date() >= new Date(event.abstractSettings?.deadline);
          }
        }
      },
      
      // Auto-transition based on conditions
      conditionalTransitions: {
        [this.states.REGISTRATION_CLOSED]: {
          to: this.states.SCHEDULE_PUBLISHED,
          condition: (event) => {
            return !event.abstractSettings?.enabled;
          }
        },
        
        [this.states.REVIEW_COMPLETED]: {
          to: this.states.SCHEDULE_PUBLISHED,
          condition: (event) => {
            return event.abstractSettings?.autoPublishSchedule;
          }
        }
      }
    };
    
    this.stateActions = {
      [this.states.REGISTRATION_OPEN]: [
        'sendRegistrationOpenNotifications',
        'activateRegistrationForm',
        'startRegistrationTracking'
      ],
      
      [this.states.REGISTRATION_CLOSING]: [
        'sendRegistrationClosingNotifications',
        'enableLastChancePromotions'
      ],
      
      [this.states.REGISTRATION_CLOSED]: [
        'sendRegistrationClosedNotifications',
        'generateAttendeeList',
        'processWaitlist'
      ],
      
      [this.states.ABSTRACT_SUBMISSION_OPEN]: [
        'sendAbstractSubmissionOpenNotifications',
        'activateSubmissionForm',
        'notifyReviewers'
      ],
      
      [this.states.ABSTRACT_SUBMISSION_CLOSED]: [
        'sendAbstractSubmissionClosedNotifications',
        'assignReviewers',
        'startReviewProcess'
      ],
      
      [this.states.REVIEW_COMPLETED]: [
        'sendReviewCompletedNotifications',
        'generateAcceptanceLetters',
        'createScheduleDraft'
      ],
      
      [this.states.SCHEDULE_PUBLISHED]: [
        'sendSchedulePublishedNotifications',
        'updateWebsite',
        'sendCalendarInvites'
      ],
      
      [this.states.IN_PROGRESS]: [
        'sendEventStartNotifications',
        'activateEventTools',
        'startEventTracking'
      ],
      
      [this.states.COMPLETED]: [
        'sendEventCompletedNotifications',
        'generateEventReport',
        'startFeedbackCollection'
      ]
    };
  }
  
  /**
   * Validate if a state transition is allowed
   */
  canTransition(currentState, targetState) {
    if (!this.states[currentState] && !Object.values(this.states).includes(currentState)) {
      throw new Error(`Invalid current state: ${currentState}`);
    }
    
    if (!this.states[targetState] && !Object.values(this.states).includes(targetState)) {
      throw new Error(`Invalid target state: ${targetState}`);
    }
    
    const currentStateValue = this.states[currentState] || currentState;
    const targetStateValue = this.states[targetState] || targetState;
    
    return this.transitions[currentStateValue]?.includes(targetStateValue) || false;
  }
  
  /**
   * Validate if event meets requirements for target state
   */
  async validateStateRequirements(event, targetState) {
    const requirements = this.stateRequirements[targetState];
    
    if (!requirements) {
      return { valid: true, errors: [] };
    }
    
    const errors = [];
    
    // Check required fields
    if (requirements.required) {
      for (const field of requirements.required) {
        if (!this.hasRequiredField(event, field)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }
    
    // Run validations
    if (requirements.validations) {
      for (const validation of requirements.validations) {
        const validationResult = await this.runValidation(event, validation);
        if (!validationResult.valid) {
          errors.push(...validationResult.errors);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Transition event to new state
   */
  async transitionTo(eventId, targetState, userId, options = {}) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      const currentState = event.status;
      
      // Check if transition is allowed
      if (!this.canTransition(currentState, targetState)) {
        throw new Error(`Cannot transition from ${currentState} to ${targetState}`);
      }
      
      // Validate requirements unless forced
      if (!options.force) {
        const validation = await this.validateStateRequirements(event, targetState);
        if (!validation.valid) {
          throw new Error(`Requirements not met: ${validation.errors.join(', ')}`);
        }
      }
      
      // Record the transition
      const transition = {
        fromState: currentState,
        toState: targetState,
        transitionedBy: userId,
        transitionedAt: new Date(),
        reason: options.reason,
        forced: options.force || false
      };
      
      // Update event state
      event.status = targetState;
      event.stateHistory = event.stateHistory || [];
      event.stateHistory.push(transition);
      
      // Execute state entry actions
      await this.executeStateActions(event, targetState, userId);
      
      // Save event
      await event.save();
      
      // Emit transition event
      this.emit('stateTransition', {
        event: event,
        transition: transition
      });
      
      // Check for automatic transitions
      await this.checkAutomaticTransitions(event);
      
      return {
        success: true,
        event: event,
        transition: transition
      };
      
    } catch (error) {
      this.emit('transitionError', {
        eventId: eventId,
        targetState: targetState,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Check and execute automatic transitions
   */
  async checkAutomaticTransitions(event) {
    const currentState = event.status;
    
    // Check time-based transitions
    const timeTransition = this.automaticTransitions.timeBasedTransitions[currentState];
    if (timeTransition && timeTransition.condition(event)) {
      await this.transitionTo(event._id, timeTransition.to, 'system', {
        reason: 'Automatic time-based transition'
      });
      return;
    }
    
    // Check conditional transitions
    const conditionalTransition = this.automaticTransitions.conditionalTransitions[currentState];
    if (conditionalTransition && conditionalTransition.condition(event)) {
      await this.transitionTo(event._id, conditionalTransition.to, 'system', {
        reason: 'Automatic conditional transition'
      });
      return;
    }
  }
  
  /**
   * Execute actions associated with entering a state
   */
  async executeStateActions(event, state, userId) {
    const actions = this.stateActions[state];
    
    if (!actions) {
      return;
    }
    
    for (const action of actions) {
      try {
        await this.executeAction(event, action, userId);
      } catch (error) {
        console.error(`Error executing action ${action} for event ${event._id}:`, error);
        // Continue with other actions even if one fails
      }
    }
  }
  
  /**
   * Execute a specific action
   */
  async executeAction(event, action, userId) {
    const notificationService = new NotificationService();
    const lifecycleService = new EventLifecycleService();
    
    switch (action) {
      case 'sendRegistrationOpenNotifications':
        await notificationService.sendEventNotification(event._id, 'registration_open', {
          targetAudience: 'all_users',
          priority: 'high'
        });
        break;
        
      case 'sendRegistrationClosingNotifications':
        await notificationService.sendEventNotification(event._id, 'registration_closing', {
          targetAudience: 'unregistered_users',
          priority: 'urgent'
        });
        break;
        
      case 'sendRegistrationClosedNotifications':
        await notificationService.sendEventNotification(event._id, 'registration_closed', {
          targetAudience: 'all_users',
          priority: 'normal'
        });
        break;
        
      case 'generateAttendeeList':
        await lifecycleService.generateAttendeeList(event._id);
        break;
        
      case 'processWaitlist':
        await lifecycleService.processWaitlist(event._id);
        break;
        
      case 'sendAbstractSubmissionOpenNotifications':
        await notificationService.sendEventNotification(event._id, 'abstract_submission_open', {
          targetAudience: 'registered_users',
          priority: 'high'
        });
        break;
        
      case 'assignReviewers':
        await lifecycleService.assignReviewers(event._id);
        break;
        
      case 'startReviewProcess':
        await lifecycleService.startReviewProcess(event._id);
        break;
        
      case 'generateAcceptanceLetters':
        await lifecycleService.generateAcceptanceLetters(event._id);
        break;
        
      case 'createScheduleDraft':
        await lifecycleService.createScheduleDraft(event._id);
        break;
        
      case 'sendSchedulePublishedNotifications':
        await notificationService.sendEventNotification(event._id, 'schedule_published', {
          targetAudience: 'registered_users',
          priority: 'high'
        });
        break;
        
      case 'sendCalendarInvites':
        await lifecycleService.sendCalendarInvites(event._id);
        break;
        
      case 'activateEventTools':
        await lifecycleService.activateEventTools(event._id);
        break;
        
      case 'startEventTracking':
        await lifecycleService.startEventTracking(event._id);
        break;
        
      case 'generateEventReport':
        await lifecycleService.generateEventReport(event._id);
        break;
        
      case 'startFeedbackCollection':
        await lifecycleService.startFeedbackCollection(event._id);
        break;
        
      default:
        console.warn(`Unknown action: ${action}`);
    }
  }
  
  /**
   * Check if event has required field
   */
  hasRequiredField(event, field) {
    const fieldPath = field.split('.');
    let current = event;
    
    for (const part of fieldPath) {
      if (current == null || current[part] == null) {
        return false;
      }
      current = current[part];
    }
    
    return true;
  }
  
  /**
   * Run validation function
   */
  async runValidation(event, validationType) {
    switch (validationType) {
      case 'dateConsistency':
        return this.validateDateConsistency(event);
        
      case 'venueAvailability':
        return this.validateVenueAvailability(event);
        
      case 'registrationConfiguration':
        return this.validateRegistrationConfiguration(event);
        
      case 'paymentSetup':
        return this.validatePaymentSetup(event);
        
      case 'abstractConfiguration':
        return this.validateAbstractConfiguration(event);
        
      case 'reviewerAssignment':
        return this.validateReviewerAssignment(event);
        
      case 'scheduleCompleteness':
        return this.validateScheduleCompleteness(event);
        
      case 'roomAssignments':
        return this.validateRoomAssignments(event);
        
      case 'attendeeConfirmation':
        return this.validateAttendeeConfirmation(event);
        
      case 'logisticsReady':
        return this.validateLogisticsReady(event);
        
      default:
        return { valid: true, errors: [] };
    }
  }
  
  /**
   * Validation functions
   */
  validateDateConsistency(event) {
    const errors = [];
    
    if (new Date(event.startDate) >= new Date(event.endDate)) {
      errors.push('End date must be after start date');
    }
    
    if (event.registrationSettings?.deadline && 
        new Date(event.registrationSettings.deadline) >= new Date(event.startDate)) {
      errors.push('Registration deadline must be before event start date');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  validateVenueAvailability(event) {
    // TODO: Implement venue availability check
    return { valid: true, errors: [] };
  }
  
  validateRegistrationConfiguration(event) {
    const errors = [];
    
    if (!event.registrationSettings?.enabled) {
      errors.push('Registration must be enabled');
    }
    
    if (!event.registrationSettings?.deadline) {
      errors.push('Registration deadline is required');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  validatePaymentSetup(event) {
    const errors = [];
    
    if (event.pricing?.registration?.amount > 0 && !event.paymentSettings?.enabled) {
      errors.push('Payment settings must be configured for paid events');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  validateAbstractConfiguration(event) {
    const errors = [];
    
    if (!event.abstractSettings?.enabled) {
      errors.push('Abstract submission must be enabled');
    }
    
    if (!event.abstractSettings?.deadline) {
      errors.push('Abstract submission deadline is required');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  validateReviewerAssignment(event) {
    // TODO: Check if reviewers are assigned
    return { valid: true, errors: [] };
  }
  
  validateScheduleCompleteness(event) {
    const errors = [];
    
    if (!event.agenda || event.agenda.length === 0) {
      errors.push('Event agenda is required');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  validateRoomAssignments(event) {
    // TODO: Check if all sessions have room assignments
    return { valid: true, errors: [] };
  }
  
  validateAttendeeConfirmation(event) {
    // TODO: Check attendee confirmation rates
    return { valid: true, errors: [] };
  }
  
  validateLogisticsReady(event) {
    // TODO: Check logistics readiness
    return { valid: true, errors: [] };
  }
  
  /**
   * Get available transitions for current state
   */
  getAvailableTransitions(currentState) {
    const stateValue = this.states[currentState] || currentState;
    return this.transitions[stateValue] || [];
  }
  
  /**
   * Get state requirements
   */
  getStateRequirements(state) {
    return this.stateRequirements[state] || {};
  }
  
  /**
   * Force transition (bypass validations)
   */
  async forceTransition(eventId, targetState, userId, reason) {
    return this.transitionTo(eventId, targetState, userId, {
      force: true,
      reason: reason
    });
  }
  
  /**
   * Get events that need automatic transitions
   */
  async getEventsForAutomaticTransition() {
    const events = await Event.find({
      status: { $in: Object.keys(this.automaticTransitions.timeBasedTransitions) },
      isDeleted: false
    });
    
    const eventsToTransition = [];
    
    for (const event of events) {
      const transition = this.automaticTransitions.timeBasedTransitions[event.status];
      if (transition && transition.condition(event)) {
        eventsToTransition.push({
          event: event,
          targetState: transition.to
        });
      }
    }
    
    return eventsToTransition;
  }
}

module.exports = EventStateMachine;
