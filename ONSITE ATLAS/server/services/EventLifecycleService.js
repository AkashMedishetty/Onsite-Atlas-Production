const Event = require('../models/Event');
const Registration = require('../models/Registration');
const AbstractSubmission = require('../models/AbstractSubmission');
const EventTemplate = require('../models/EventTemplate');
const PaymentPlan = require('../models/PaymentPlan');
const NotificationService = require('./NotificationService');
const AbstractService = require('./AbstractService');
const EventStateMachine = require('./EventStateMachine');
const EventEmitter = require('events');

class EventLifecycleService extends EventEmitter {
  constructor() {
    super();
    this.notificationService = new NotificationService();
    this.abstractService = new AbstractService();
    this.stateMachine = new EventStateMachine();
  }

  /**
   * Create event from template
   */
  async createFromTemplate(templateId, eventData, userId) {
    try {
      const template = await EventTemplate.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const event = new Event({
        ...template.defaultSettings,
        ...eventData,
        createdBy: userId,
        status: 'draft',
        templateId: templateId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Apply template-specific configurations
      if (template.registrationSettings) {
        event.registrationSettings = {
          ...template.registrationSettings,
          ...eventData.registrationSettings
        };
      }

      if (template.abstractSettings) {
        event.abstractSettings = {
          ...template.abstractSettings,
          ...eventData.abstractSettings
        };
      }

      if (template.emailTemplates) {
        event.emailTemplates = template.emailTemplates;
      }

      if (template.agenda) {
        event.agenda = template.agenda.map(item => ({
          ...item,
          eventId: event._id
        }));
      }

      await event.save();

      this.emit('eventCreated', { event, template, userId });

      return event;
    } catch (error) {
      console.error('Error creating event from template:', error);
      throw error;
    }
  }

  /**
   * Generate attendee list and manage capacity
   */
  async generateAttendeeList(eventId) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      // Get all confirmed registrations
      const registrations = await Registration.find({
        eventId: eventId,
        status: 'confirmed',
        isDeleted: false
      }).populate('userId', 'firstName lastName email');

      // Sort by registration date for waitlist processing
      registrations.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      const attendeeList = [];
      const waitlist = [];
      const maxCapacity = event.capacity?.max || Infinity;

      // Categorize attendees
      for (const registration of registrations) {
        const attendee = {
          userId: registration.userId._id,
          registrationId: registration._id,
          firstName: registration.userId.firstName,
          lastName: registration.userId.lastName,
          email: registration.userId.email,
          registrationDate: registration.createdAt,
          ticketType: registration.ticketType,
          status: registration.status,
          paymentStatus: registration.paymentStatus,
          specialRequirements: registration.specialRequirements,
          sessions: registration.sessions || []
        };

        if (attendeeList.length < maxCapacity) {
          attendeeList.push(attendee);
        } else {
          waitlist.push(attendee);
        }
      }

      // Update event with attendee information
      event.attendeeList = attendeeList;
      event.waitlist = waitlist;
      event.attendeeCount = attendeeList.length;
      event.waitlistCount = waitlist.length;
      event.updatedAt = new Date();

      await event.save();

      // Send notifications to waitlisted attendees
      if (waitlist.length > 0) {
        await this.notificationService.sendBulkNotifications(
          waitlist.map(attendee => ({
            userId: attendee.userId,
            type: 'waitlist_status',
            eventId: eventId,
            data: {
              position: waitlist.findIndex(w => w.userId === attendee.userId) + 1,
              totalWaitlist: waitlist.length
            }
          }))
        );
      }

      this.emit('attendeeListGenerated', { event, attendeeList, waitlist });

      return {
        attendeeList,
        waitlist,
        stats: {
          confirmed: attendeeList.length,
          waitlisted: waitlist.length,
          capacity: maxCapacity,
          utilizationRate: maxCapacity === Infinity ? 0 : (attendeeList.length / maxCapacity) * 100
        }
      };
    } catch (error) {
      console.error('Error generating attendee list:', error);
      throw error;
    }
  }

  /**
   * Process waitlist when spots become available
   */
  async processWaitlist(eventId) {
    try {
      const event = await Event.findById(eventId);
      if (!event || !event.waitlist || event.waitlist.length === 0) {
        return { processed: 0, notifications: 0 };
      }

      const maxCapacity = event.capacity?.max || Infinity;
      const currentAttendees = event.attendeeList?.length || 0;
      const availableSpots = maxCapacity - currentAttendees;

      if (availableSpots <= 0) {
        return { processed: 0, notifications: 0 };
      }

      // Move attendees from waitlist to attendee list
      const toPromote = event.waitlist.slice(0, availableSpots);
      const remainingWaitlist = event.waitlist.slice(availableSpots);

      // Update registrations to confirmed
      const registrationIds = toPromote.map(attendee => attendee.registrationId);
      await Registration.updateMany(
        { _id: { $in: registrationIds } },
        { 
          status: 'confirmed',
          waitlistPosition: null,
          promotedAt: new Date()
        }
      );

      // Update event
      event.attendeeList = [...(event.attendeeList || []), ...toPromote];
      event.waitlist = remainingWaitlist;
      event.attendeeCount = event.attendeeList.length;
      event.waitlistCount = remainingWaitlist.length;
      event.updatedAt = new Date();

      await event.save();

      // Send promotion notifications
      const promotionNotifications = toPromote.map(attendee => ({
        userId: attendee.userId,
        type: 'waitlist_promoted',
        eventId: eventId,
        priority: 'high',
        data: {
          eventName: event.title,
          registrationDeadline: event.registrationSettings?.deadline
        }
      }));

      await this.notificationService.sendBulkNotifications(promotionNotifications);

      // Update waitlist positions for remaining attendees
      if (remainingWaitlist.length > 0) {
        const positionUpdates = remainingWaitlist.map((attendee, index) => ({
          userId: attendee.userId,
          type: 'waitlist_position_updated',
          eventId: eventId,
          data: {
            newPosition: index + 1,
            totalWaitlist: remainingWaitlist.length
          }
        }));

        await this.notificationService.sendBulkNotifications(positionUpdates);
      }

      this.emit('waitlistProcessed', { 
        event, 
        promoted: toPromote, 
        remaining: remainingWaitlist 
      });

      return {
        processed: toPromote.length,
        notifications: promotionNotifications.length,
        remainingWaitlist: remainingWaitlist.length
      };
    } catch (error) {
      console.error('Error processing waitlist:', error);
      throw error;
    }
  }

  /**
   * Assign reviewers to abstracts
   */
  async assignReviewers(eventId) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      const abstracts = await AbstractSubmission.find({
        eventId: eventId,
        status: 'submitted',
        isDeleted: false
      });

      let assignedCount = 0;
      let errorCount = 0;

      for (const abstract of abstracts) {
        try {
          await this.abstractService.assignReviewers(abstract._id, {
            automatic: true,
            reviewersPerAbstract: event.abstractSettings?.reviewersPerAbstract || 3
          });
          assignedCount++;
        } catch (error) {
          console.error(`Error assigning reviewers to abstract ${abstract._id}:`, error);
          errorCount++;
        }
      }

      this.emit('reviewersAssigned', { 
        eventId, 
        assignedCount, 
        errorCount, 
        totalAbstracts: abstracts.length 
      });

      return {
        assignedCount,
        errorCount,
        totalAbstracts: abstracts.length
      };
    } catch (error) {
      console.error('Error assigning reviewers:', error);
      throw error;
    }
  }

  /**
   * Start abstract review process
   */
  async startReviewProcess(eventId) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      // Get all abstracts with assigned reviewers
      const abstracts = await AbstractSubmission.find({
        eventId: eventId,
        status: 'submitted',
        'reviewers.0': { $exists: true }, // Has at least one reviewer
        isDeleted: false
      }).populate('reviewers.userId', 'firstName lastName email');

      const reviewerNotifications = new Map();

      // Collect reviewer notifications
      for (const abstract of abstracts) {
        for (const reviewer of abstract.reviewers) {
          if (!reviewerNotifications.has(reviewer.userId._id.toString())) {
            reviewerNotifications.set(reviewer.userId._id.toString(), {
              userId: reviewer.userId._id,
              email: reviewer.userId.email,
              name: `${reviewer.userId.firstName} ${reviewer.userId.lastName}`,
              abstracts: []
            });
          }

          reviewerNotifications.get(reviewer.userId._id.toString()).abstracts.push({
            abstractId: abstract._id,
            title: abstract.title,
            deadline: reviewer.deadline || event.abstractSettings?.reviewDeadline
          });
        }
      }

      // Send notifications to reviewers
      const notifications = Array.from(reviewerNotifications.values()).map(reviewer => ({
        userId: reviewer.userId,
        type: 'review_assignment',
        eventId: eventId,
        priority: 'high',
        data: {
          eventName: event.title,
          abstractCount: reviewer.abstracts.length,
          abstracts: reviewer.abstracts,
          reviewDeadline: event.abstractSettings?.reviewDeadline
        }
      }));

      await this.notificationService.sendBulkNotifications(notifications);

      // Update event review status
      event.reviewProcess = {
        started: true,
        startedAt: new Date(),
        totalAbstracts: abstracts.length,
        totalReviewers: reviewerNotifications.size
      };

      await event.save();

      this.emit('reviewProcessStarted', { 
        eventId, 
        abstracts: abstracts.length,
        reviewers: reviewerNotifications.size
      });

      return {
        abstractsInReview: abstracts.length,
        reviewersNotified: reviewerNotifications.size,
        notifications: notifications.length
      };
    } catch (error) {
      console.error('Error starting review process:', error);
      throw error;
    }
  }

  /**
   * Generate acceptance letters
   */
  async generateAcceptanceLetters(eventId) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      const abstracts = await AbstractSubmission.find({
        eventId: eventId,
        finalDecision: { $in: ['accepted', 'rejected'] },
        isDeleted: false
      }).populate('authorId', 'firstName lastName email');

      const acceptedAbstracts = abstracts.filter(a => a.finalDecision === 'accepted');
      const rejectedAbstracts = abstracts.filter(a => a.finalDecision === 'rejected');

      // Generate acceptance notifications
      const acceptanceNotifications = acceptedAbstracts.map(abstract => ({
        userId: abstract.authorId._id,
        type: 'abstract_accepted',
        eventId: eventId,
        priority: 'high',
        data: {
          abstractTitle: abstract.title,
          eventName: event.title,
          presentationDetails: abstract.presentationDetails,
          nextSteps: event.abstractSettings?.acceptanceInstructions
        }
      }));

      // Generate rejection notifications
      const rejectionNotifications = rejectedAbstracts.map(abstract => ({
        userId: abstract.authorId._id,
        type: 'abstract_rejected',
        eventId: eventId,
        priority: 'normal',
        data: {
          abstractTitle: abstract.title,
          eventName: event.title,
          feedback: abstract.reviewerFeedback,
          encouragement: event.abstractSettings?.rejectionMessage
        }
      }));

      // Send all notifications
      await this.notificationService.sendBulkNotifications([
        ...acceptanceNotifications,
        ...rejectionNotifications
      ]);

      // Update event with acceptance statistics
      event.acceptanceStats = {
        totalSubmissions: abstracts.length,
        accepted: acceptedAbstracts.length,
        rejected: rejectedAbstracts.length,
        acceptanceRate: abstracts.length > 0 ? (acceptedAbstracts.length / abstracts.length) * 100 : 0,
        generatedAt: new Date()
      };

      await event.save();

      this.emit('acceptanceLettersGenerated', { 
        eventId, 
        accepted: acceptedAbstracts.length,
        rejected: rejectedAbstracts.length
      });

      return {
        accepted: acceptedAbstracts.length,
        rejected: rejectedAbstracts.length,
        total: abstracts.length,
        acceptanceRate: event.acceptanceStats.acceptanceRate
      };
    } catch (error) {
      console.error('Error generating acceptance letters:', error);
      throw error;
    }
  }

  /**
   * Create schedule draft from accepted abstracts
   */
  async createScheduleDraft(eventId) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      const acceptedAbstracts = await AbstractSubmission.find({
        eventId: eventId,
        finalDecision: 'accepted',
        isDeleted: false
      }).populate('authorId', 'firstName lastName');

      // Group abstracts by type/track
      const abstractsByType = {};
      acceptedAbstracts.forEach(abstract => {
        const type = abstract.type || 'general';
        if (!abstractsByType[type]) {
          abstractsByType[type] = [];
        }
        abstractsByType[type].push(abstract);
      });

      const schedule = {
        sessions: [],
        tracks: Object.keys(abstractsByType),
        totalPresentations: acceptedAbstracts.length,
        createdAt: new Date(),
        status: 'draft'
      };

      // Create sessions based on event duration and abstract count
      const eventDuration = this.calculateEventDuration(event.startDate, event.endDate);
      const sessionDuration = event.sessionSettings?.defaultDuration || 60; // minutes
      const breakDuration = event.sessionSettings?.breakDuration || 15; // minutes

      let currentTime = new Date(event.startDate);
      let sessionIndex = 0;

      for (const [type, typeAbstracts] of Object.entries(abstractsByType)) {
        for (const abstract of typeAbstracts) {
          const session = {
            id: `session_${sessionIndex++}`,
            title: abstract.title,
            abstractId: abstract._id,
            presenter: {
              name: `${abstract.authorId.firstName} ${abstract.authorId.lastName}`,
              userId: abstract.authorId._id
            },
            startTime: new Date(currentTime),
            endTime: new Date(currentTime.getTime() + sessionDuration * 60000),
            duration: sessionDuration,
            type: type,
            track: type,
            room: null, // To be assigned later
            description: abstract.description,
            status: 'scheduled'
          };

          schedule.sessions.push(session);
          
          // Move to next slot
          currentTime = new Date(currentTime.getTime() + (sessionDuration + breakDuration) * 60000);
        }
      }

      // Update event with schedule
      event.schedule = schedule;
      event.scheduleStatus = 'draft';
      event.updatedAt = new Date();

      await event.save();

      this.emit('scheduleDraftCreated', { 
        eventId, 
        sessionCount: schedule.sessions.length,
        tracks: schedule.tracks.length
      });

      return {
        sessionCount: schedule.sessions.length,
        tracks: schedule.tracks,
        totalPresentations: acceptedAbstracts.length,
        schedule: schedule
      };
    } catch (error) {
      console.error('Error creating schedule draft:', error);
      throw error;
    }
  }

  /**
   * Send calendar invites to attendees
   */
  async sendCalendarInvites(eventId) {
    try {
      const event = await Event.findById(eventId);
      if (!event || !event.attendeeList) {
        throw new Error('Event or attendee list not found');
      }

      const calendarInvites = event.attendeeList.map(attendee => ({
        userId: attendee.userId,
        type: 'calendar_invite',
        eventId: eventId,
        priority: 'high',
        data: {
          eventName: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          location: event.venue,
          description: event.description,
          icsContent: this.generateICSContent(event)
        }
      }));

      await this.notificationService.sendBulkNotifications(calendarInvites);

      this.emit('calendarInvitesSent', { 
        eventId, 
        inviteeCount: calendarInvites.length 
      });

      return {
        invitesSent: calendarInvites.length,
        attendees: event.attendeeList.length
      };
    } catch (error) {
      console.error('Error sending calendar invites:', error);
      throw error;
    }
  }

  /**
   * Activate event tools and systems
   */
  async activateEventTools(eventId) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      const activatedTools = [];

      // Activate check-in system
      if (event.tools?.checkIn?.enabled) {
        event.tools.checkIn.active = true;
        event.tools.checkIn.activatedAt = new Date();
        activatedTools.push('checkIn');
      }

      // Activate live streaming
      if (event.tools?.liveStreaming?.enabled) {
        event.tools.liveStreaming.active = true;
        event.tools.liveStreaming.activatedAt = new Date();
        activatedTools.push('liveStreaming');
      }

      // Activate networking features
      if (event.tools?.networking?.enabled) {
        event.tools.networking.active = true;
        event.tools.networking.activatedAt = new Date();
        activatedTools.push('networking');
      }

      // Activate mobile app
      if (event.tools?.mobileApp?.enabled) {
        event.tools.mobileApp.active = true;
        event.tools.mobileApp.activatedAt = new Date();
        activatedTools.push('mobileApp');
      }

      await event.save();

      this.emit('eventToolsActivated', { 
        eventId, 
        activatedTools 
      });

      return {
        activatedTools,
        totalTools: activatedTools.length
      };
    } catch (error) {
      console.error('Error activating event tools:', error);
      throw error;
    }
  }

  /**
   * Start event tracking and analytics
   */
  async startEventTracking(eventId) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      const tracking = {
        started: true,
        startedAt: new Date(),
        metrics: {
          attendeeCount: event.attendeeList?.length || 0,
          sessionCount: event.schedule?.sessions?.length || 0,
          checkIns: 0,
          liveViewers: 0,
          interactions: 0,
          feedback: 0
        },
        realTimeData: {
          currentSession: null,
          activeUsers: 0,
          systemStatus: 'operational'
        }
      };

      event.tracking = tracking;
      await event.save();

      this.emit('eventTrackingStarted', { 
        eventId, 
        tracking 
      });

      return tracking;
    } catch (error) {
      console.error('Error starting event tracking:', error);
      throw error;
    }
  }

  /**
   * Generate event report
   */
  async generateEventReport(eventId) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      const registrations = await Registration.find({
        eventId: eventId,
        isDeleted: false
      });

      const abstracts = await AbstractSubmission.find({
        eventId: eventId,
        isDeleted: false
      });

      const report = {
        eventId: eventId,
        eventName: event.title,
        eventDates: {
          start: event.startDate,
          end: event.endDate
        },
        generatedAt: new Date(),
        
        // Registration statistics
        registration: {
          totalRegistrations: registrations.length,
          confirmedRegistrations: registrations.filter(r => r.status === 'confirmed').length,
          cancelledRegistrations: registrations.filter(r => r.status === 'cancelled').length,
          waitlistSize: event.waitlistCount || 0,
          attendanceRate: event.tracking?.metrics?.checkIns || 0,
          registrationsByDate: this.getRegistrationsByDate(registrations)
        },

        // Abstract statistics
        abstracts: {
          totalSubmissions: abstracts.length,
          acceptedAbstracts: abstracts.filter(a => a.finalDecision === 'accepted').length,
          rejectedAbstracts: abstracts.filter(a => a.finalDecision === 'rejected').length,
          acceptanceRate: abstracts.length > 0 ? (abstracts.filter(a => a.finalDecision === 'accepted').length / abstracts.length) * 100 : 0,
          submissionsByDate: this.getSubmissionsByDate(abstracts)
        },

        // Financial summary
        financial: {
          totalRevenue: this.calculateTotalRevenue(registrations),
          refundedAmount: this.calculateRefundedAmount(registrations),
          pendingPayments: this.calculatePendingPayments(registrations),
          revenueBreakdown: this.getRevenueBreakdown(registrations)
        },

        // Event performance
        performance: {
          capacityUtilization: event.capacity?.max ? (event.attendeeCount / event.capacity.max) * 100 : 0,
          sessionCount: event.schedule?.sessions?.length || 0,
          trackCount: event.schedule?.tracks?.length || 0,
          averageSessionDuration: this.calculateAverageSessionDuration(event.schedule?.sessions || []),
          systemUptime: this.calculateSystemUptime(event.tracking)
        },

        // Feedback and engagement
        engagement: {
          feedbackCount: event.tracking?.metrics?.feedback || 0,
          averageRating: event.averageRating || 0,
          networkingInteractions: event.tracking?.metrics?.interactions || 0,
          liveStreamViewers: event.tracking?.metrics?.liveViewers || 0
        }
      };

      // Save report
      event.finalReport = report;
      await event.save();

      this.emit('eventReportGenerated', { 
        eventId, 
        report 
      });

      return report;
    } catch (error) {
      console.error('Error generating event report:', error);
      throw error;
    }
  }

  /**
   * Start feedback collection
   */
  async startFeedbackCollection(eventId) {
    try {
      const event = await Event.findById(eventId);
      if (!event || !event.attendeeList) {
        throw new Error('Event or attendee list not found');
      }

      const feedbackRequests = event.attendeeList.map(attendee => ({
        userId: attendee.userId,
        type: 'feedback_request',
        eventId: eventId,
        priority: 'normal',
        data: {
          eventName: event.title,
          feedbackDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          feedbackUrl: `${process.env.FRONTEND_URL}/feedback/${eventId}`,
          incentive: event.feedbackSettings?.incentive || null
        }
      }));

      await this.notificationService.sendBulkNotifications(feedbackRequests);

      // Schedule reminder notifications
      if (event.feedbackSettings?.reminders?.enabled) {
        const reminderDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
        await this.notificationService.scheduleWorkflow({
          eventId: eventId,
          type: 'feedback_reminder',
          scheduledFor: reminderDate,
          targetAudience: 'attendees_without_feedback'
        });
      }

      this.emit('feedbackCollectionStarted', { 
        eventId, 
        requestsSent: feedbackRequests.length 
      });

      return {
        requestsSent: feedbackRequests.length,
        attendees: event.attendeeList.length
      };
    } catch (error) {
      console.error('Error starting feedback collection:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  calculateEventDuration(startDate, endDate) {
    return Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
  }

  generateICSContent(event) {
    const start = new Date(event.startDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const end = new Date(event.endDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PurpleHat//Event Management//EN
BEGIN:VEVENT
UID:${event._id}@purplehat.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${start}
DTEND:${end}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
LOCATION:${event.venue || ''}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
  }

  getRegistrationsByDate(registrations) {
    const byDate = {};
    registrations.forEach(reg => {
      const date = new Date(reg.createdAt).toISOString().split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
    });
    return byDate;
  }

  getSubmissionsByDate(abstracts) {
    const byDate = {};
    abstracts.forEach(abstract => {
      const date = new Date(abstract.createdAt).toISOString().split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
    });
    return byDate;
  }

  calculateTotalRevenue(registrations) {
    return registrations
      .filter(reg => reg.paymentStatus === 'paid')
      .reduce((total, reg) => total + (reg.amount || 0), 0);
  }

  calculateRefundedAmount(registrations) {
    return registrations
      .filter(reg => reg.paymentStatus === 'refunded')
      .reduce((total, reg) => total + (reg.amount || 0), 0);
  }

  calculatePendingPayments(registrations) {
    return registrations
      .filter(reg => reg.paymentStatus === 'pending')
      .reduce((total, reg) => total + (reg.amount || 0), 0);
  }

  getRevenueBreakdown(registrations) {
    const breakdown = {};
    registrations.forEach(reg => {
      if (reg.paymentStatus === 'paid') {
        const type = reg.ticketType || 'general';
        breakdown[type] = (breakdown[type] || 0) + (reg.amount || 0);
      }
    });
    return breakdown;
  }

  calculateAverageSessionDuration(sessions) {
    if (!sessions || sessions.length === 0) return 0;
    const totalDuration = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    return totalDuration / sessions.length;
  }

  calculateSystemUptime(tracking) {
    if (!tracking || !tracking.startedAt) return 0;
    const uptime = Date.now() - new Date(tracking.startedAt).getTime();
    return Math.round(uptime / (1000 * 60 * 60)); // hours
  }
}

module.exports = EventLifecycleService;
