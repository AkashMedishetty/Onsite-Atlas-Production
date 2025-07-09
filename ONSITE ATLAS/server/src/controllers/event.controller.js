const { Event, Category, Registration, Resource } = require('../models');
const { createApiError } = require('../middleware/error');
const logger = require('../utils/logger');
const { sendSuccess, sendPaginated } = require('../utils/responseFormatter');
const StandardErrorHandler = require('../utils/standardErrorHandler');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User'); // Import User model
const ResourceSetting = require('./resource.controller').ResourceSetting || require('../models/ResourceSetting');

/**
 * Get all events with pagination
 * @route GET /api/events
 * @access Private
 */
const getEvents = asyncHandler(async (req, res) => {
  // Extract query parameters
  const { page = 1, limit = 10, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  
  // Build filter object
  const filter = {};
  if (status) filter.status = status;
  
  // Calculate pagination
  const skip = (page - 1) * limit;
  
  // PERFORMANCE OPTIMIZATION: Use aggregation pipeline to get events with registration counts in one query
  const aggregationPipeline = [
    // Match filter criteria
    { $match: filter },
    
    // Lookup registration counts for each event
    {
      $lookup: {
        from: 'registrations',
        localField: '_id',
        foreignField: 'event',
        as: 'registrations'
      }
    },
    
    // Add registration count field
    {
      $addFields: {
        registrationCount: { $size: '$registrations' }
      }
    },
    
    // Remove the registrations array to save memory
    {
      $project: {
        registrations: 0
      }
    },
    
    // Sort
    {
      $sort: {
        [sortBy]: sortOrder === 'desc' ? -1 : 1
      }
    },
    
    // Add pagination
    {
      $facet: {
        events: [
          { $skip: skip },
          { $limit: parseInt(limit) }
        ],
        totalCount: [
          { $count: "count" }
        ]
      }
    }
  ];
  
  // Execute aggregation
  const result = await Event.aggregate(aggregationPipeline);
  const events = result[0].events || [];
  const total = result[0].totalCount[0]?.count || 0;
  

  
  // Use sendPaginated utility for consistent response format
  return sendPaginated(
    res, 
    200, 
    'Events retrieved successfully',
    events,
    parseInt(page),
    parseInt(limit),
    total
  );
});

/**
 * Get event by ID
 * @route GET /api/events/:id
 * @access Private
 */
const getEventById = asyncHandler(async (req, res) => {
  try {
    const eventId = req?.params?.id;
    
    // Log the request for debugging
    logger.info(`Fetching event with ID: ${eventId}`);
    
    // Validate MongoDB ObjectID format
    if (!mongoose?.Types?.ObjectId.isValid(eventId)) {
      return sendSuccess(res, 400, 'Invalid event ID format');
    }
    
    const event = await Event.findById(eventId)
      .populate('registrationCount');
    
    if (!event) {
      return sendSuccess(res, 404, 'Event not found');
    }
    
    // Manual registration count calculation as fallback
    if (!event.registrationCount) {
      const count = await Registration.countDocuments({ event: event._id });
      event.registrationCount = count;
    }
    
    return sendSuccess(res, 200, 'Event retrieved successfully', event);
  } catch (error) {
    logger.error(`Error in getEventById: ${error.message}`);
    return sendSuccess(res, 500, 'Server error while fetching event', null, { error: error.message });
  }
});

/**
 * Create new event
 * @route POST /api/events
 * @access Private
 */
const createEvent = asyncHandler(async (req, res) => {
  // Log the request body for debugging
  logger.info('Creating new event with data:', req.body);
  logger.info(`Creating new event: ${JSON.stringify(req.body)}`);

  try {
    // Ensure venue data is properly structured
    const venueData = req?.body?.venue || {};
    const venue = {
      name: venueData.name || '',
      address: venueData.address || '',
      city: venueData.city || '',
      state: venueData.state || '',
      country: venueData.country || '',
      zipCode: venueData.zipCode || ''
    };

    // Prepare the event data
    const eventData = {
      ...req.body,
      venue,
      createdBy: req?.user?._id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create the event
    const event = await Event.create(eventData);
    return sendSuccess(res, 201, 'Event created successfully', event);
  } catch (error) {
    logger.error(`Error in createEvent: ${error.message}`);
    return sendSuccess(res, 500, 'Failed to create event', null, { error: error.message });
  }
});

/**
 * Update event
 * @route PUT /api/events/:id
 * @access Private
 */
const updateEvent = asyncHandler(async (req, res) => {
  try {
    logger.info('[updateEvent] Received update data:', JSON.stringify(req.body, null, 2));
    
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Remove sensitive fields that shouldn't be updated via general update
    delete updateData.createdBy;
    delete updateData.createdAt;
    delete updateData.__v;
    
    // COMPREHENSIVE PROTECTION: Prevent accidental overwrites of complex settings
    
    // Get current event to compare
    const currentEvent = await Event.findById(id);
    if (!currentEvent) {
      return sendSuccess(res, 404, 'Event not found');
    }
    
    // ENUM FIELD PROTECTION: Prevent undefined enum values that cause validation errors
    
    // Protect status enum - only update if valid value provided
    if (updateData.status !== undefined) {
      const validStatuses = ['draft', 'published', 'archived']; // Match Event model schema
      if (!validStatuses.includes(updateData.status)) {
        logger.info(`[updateEvent] Invalid status '${updateData.status}', preserving current: '${currentEvent.status}'`);
        delete updateData.status; // Remove invalid status, preserve current
      }
    }
    
    // Protect paymentConfig enum fields
    if (updateData.paymentConfig) {
      if (updateData.paymentConfig.provider !== undefined) {
        const validProviders = ['razorpay','instamojo','stripe','phonepe','cashfree','payu','paytm','hdfc','axis']; // Match Event model schema
        if (!validProviders.includes(updateData.paymentConfig.provider)) {
          logger.info(`[updateEvent] Invalid payment provider, preserving current`);
          updateData.paymentConfig.provider = currentEvent.paymentConfig?.provider || 'razorpay';
        }
      }
      
      if (updateData.paymentConfig.mode !== undefined) {
        const validModes = ['live', 'test'];
        if (!validModes.includes(updateData.paymentConfig.mode)) {
          logger.info(`[updateEvent] Invalid payment mode, preserving current`);
          updateData.paymentConfig.mode = currentEvent.paymentConfig?.mode || 'test';
        }
      }
    }
    
    // Protect badgeSettings enum fields
    if (updateData.badgeSettings) {
      if (updateData.badgeSettings.orientation !== undefined) {
        const validOrientations = ['portrait', 'landscape'];
        if (!validOrientations.includes(updateData.badgeSettings.orientation)) {
          logger.info(`[updateEvent] Invalid badge orientation, preserving current`);
          updateData.badgeSettings.orientation = currentEvent.badgeSettings?.orientation || 'portrait';
        }
      }
      
      if (updateData.badgeSettings.unit !== undefined) {
        const validUnits = ['mm', 'in', 'px'];
        if (!validUnits.includes(updateData.badgeSettings.unit)) {
          logger.info(`[updateEvent] Invalid badge unit, preserving current`);
          updateData.badgeSettings.unit = currentEvent.badgeSettings?.unit || 'mm';
        }
      }
    }
    
    // Remove undefined top-level fields that could cause issues
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    // Remove undefined nested fields in objects
    if (updateData.paymentConfig && typeof updateData.paymentConfig === 'object') {
      Object.keys(updateData.paymentConfig).forEach(key => {
        if (updateData.paymentConfig[key] === undefined) {
          delete updateData.paymentConfig[key];
        }
      });
    }
    
    if (updateData.badgeSettings && typeof updateData.badgeSettings === 'object') {
      Object.keys(updateData.badgeSettings).forEach(key => {
        if (updateData.badgeSettings[key] === undefined) {
          delete updateData.badgeSettings[key];
        }
      });
    }
    
    // Protection for Pricing Rules - preserve if update contains empty/missing pricing rules
    if (currentEvent.pricingRules && currentEvent?.pricingRules?.length > 0) {
      if (!updateData.pricingRules || updateData?.pricingRules?.length === 0) {
        logger.info('[updateEvent] Protecting existing pricingRules from overwrite');
        delete updateData.pricingRules; // Remove from update to preserve existing
      }
    }
    
    // Protection for Registration Settings - preserve if not specifically updating
    if (currentEvent.registrationSettings && 
        updateData.registrationSettings && 
        Object.keys(updateData.registrationSettings).length === 0) {
      logger.info('[updateEvent] Protecting existing registrationSettings from overwrite');
      delete updateData.registrationSettings;
    }
    
    // ADDITIONAL SAFETY: Remove complex settings that might have validation issues if not being updated
    if (updateData.registrationSettings && updateData.registrationSettings.customFields) {
      // Check if customFields contains invalid enum values
      updateData.registrationSettings.customFields = updateData.registrationSettings.customFields.filter(field => {
        if (field.type && !['text', 'number', 'date', 'select', 'checkbox'].includes(field.type)) {
          logger.info(`[updateEvent] Removing custom field with invalid type: ${field.type}`);
          return false;
        }
        return true;
      });
    }
    
    // Protection for Abstract Settings - preserve if not specifically updating
    if (currentEvent.abstractSettings && 
        updateData.abstractSettings && 
        Object.keys(updateData.abstractSettings).length === 0) {
      logger.info('[updateEvent] Protecting existing abstractSettings from overwrite');
      delete updateData.abstractSettings;
    }
    
    // Protection for Email Settings - preserve if not specifically updating
    if (currentEvent.emailSettings && 
        updateData.emailSettings && 
        Object.keys(updateData.emailSettings).length === 0) {
      logger.info('[updateEvent] Protecting existing emailSettings from overwrite');
      delete updateData.emailSettings;
    }
    
    // ADDITIONAL SAFETY: Clean emailHistory of invalid enum values
    if (updateData.emailHistory && Array.isArray(updateData.emailHistory)) {
      updateData.emailHistory = updateData.emailHistory.filter(email => {
        // Remove emails with invalid status or templateUsed values
        if (email.status && !['pending', 'completed', 'completed_with_errors', 'failed'].includes(email.status)) {
          logger.info(`[updateEvent] Removing email with invalid status: ${email.status}`);
          return false;
        }
        if (email.templateUsed && !['registration', 'reminder', 'certificate', 'workshop', 'custom', 'abstractSubmission', 'abstractApproved', 'abstractRejected', 'abstractRevisionRequested', 'authorSignup'].includes(email.templateUsed)) {
          logger.info(`[updateEvent] Removing email with invalid templateUsed: ${email.templateUsed}`);
          return false;
        }
        return true;
      });
    }
    
    // Protection for Badge Settings - preserve if not specifically updating
    if (currentEvent.badgeSettings && 
        updateData.badgeSettings && 
        Object.keys(updateData.badgeSettings).length === 0) {
      logger.info('[updateEvent] Protecting existing badgeSettings from overwrite');
      delete updateData.badgeSettings;
    }
    
    // Protection for Resource Settings - preserve if not specifically updating
    if (currentEvent.resourceSettings && 
        updateData.resourceSettings && 
        Object.keys(updateData.resourceSettings).length === 0) {
      logger.info('[updateEvent] Protecting existing resourceSettings from overwrite');
      delete updateData.resourceSettings;
    }
    
    // Protection for Payment Settings - preserve if not specifically updating
    if (currentEvent.paymentSettings && 
        updateData.paymentSettings && 
        Object.keys(updateData.paymentSettings).length === 0) {
      logger.info('[updateEvent] Protecting existing paymentSettings from overwrite');
      delete updateData.paymentSettings;
    }
    
    // Protection for Categories - preserve if update contains empty array
    if (currentEvent.categories && currentEvent?.categories?.length > 0) {
      if (!updateData.categories || updateData?.categories?.length === 0) {
        logger.info('[updateEvent] Protecting existing categories from overwrite');
        delete updateData.categories;
      }
    }
    
    // Protection for Workshops - preserve if update contains empty array
    if (currentEvent.workshops && currentEvent?.workshops?.length > 0) {
      if (!updateData.workshops || updateData?.workshops?.length === 0) {
        logger.info('[updateEvent] Protecting existing workshops from overwrite');
        delete updateData.workshops;
      }
    }
    
    // Protection for Schedule - preserve if not specifically updating
    if (currentEvent.schedule && 
        updateData.schedule && 
        Object.keys(updateData.schedule).length === 0) {
      logger.info('[updateEvent] Protecting existing schedule from overwrite');
      delete updateData.schedule;
    }
    
    // Protection for Venue - only update if meaningful data provided
    if (updateData.venue && Object.keys(updateData.venue).length === 1 && updateData?.venue?.name) {
      // This is likely just a location update, preserve other venue data
      updateData.venue = {
        ...currentEvent.venue,
        name: updateData?.venue?.name
      };
    }
    
    logger.info('[updateEvent] Final update data after protection:', JSON.stringify(updateData, null, 2));
    
    // Additional validation logging
    if (updateData.status) {
      logger.info(`[updateEvent] Status value being set: '${updateData.status}' (type: ${typeof updateData.status})`);
    }
    if (updateData.paymentConfig?.provider) {
      logger.info(`[updateEvent] Payment provider being set: '${updateData.paymentConfig.provider}'`);
    }
    if (updateData.badgeSettings?.orientation) {
      logger.info(`[updateEvent] Badge orientation being set: '${updateData.badgeSettings.orientation}'`);
    }
    
    // COMPREHENSIVE LOGGING: Log every step of the update process
    logger.info(`[updateEvent] About to call Event.findByIdAndUpdate with ID: ${id}`);
    logger.info(`[updateEvent] Update options: { new: true, runValidators: true }`);
    
    // Log the current Event model schema version for debugging
    logger.info(`[updateEvent] Event model schema paths: ${Object.keys(Event.schema.paths).join(', ')}`);
    
    let updatedEvent;
    try {
      logger.info(`[updateEvent] Starting findByIdAndUpdate operation...`);
      updatedEvent = await Event.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
      logger.info(`[updateEvent] findByIdAndUpdate completed successfully`);
    } catch (updateError) {
      logger.error(`[updateEvent] findByIdAndUpdate failed with error:`, updateError);
      logger.error(`[updateEvent] Error name: ${updateError.name}`);
      logger.error(`[updateEvent] Error message: ${updateError.message}`);
      logger.error(`[updateEvent] Error stack: ${updateError.stack}`);
      
      // If it's a validation error, log detailed information
      if (updateError.name === 'ValidationError') {
        logger.error(`[updateEvent] VALIDATION ERROR DETAILS:`);
        logger.error(`[updateEvent] Error.errors object:`, JSON.stringify(updateError.errors, null, 2));
        
        // Log each validation error field
        Object.keys(updateError.errors).forEach(field => {
          const fieldError = updateError.errors[field];
          logger.error(`[updateEvent] Validation error for field '${field}':`);
          logger.error(`  - Message: ${fieldError.message}`);
          logger.error(`  - Value: ${JSON.stringify(fieldError.value)}`);
          logger.error(`  - Path: ${fieldError.path}`);
          logger.error(`  - Kind: ${fieldError.kind}`);
          logger.error(`  - Field Error Object:`, JSON.stringify(fieldError, null, 2));
        });
      }
      
      // Re-throw the error to be handled by the outer catch block
      throw updateError;
    }

    if (!updatedEvent) {
      logger.error(`[updateEvent] Event not found after update attempt`);
      return sendSuccess(res, 404, 'Event not found');
    }

    logger.info('[updateEvent] Successfully updated event');
    return sendSuccess(res, 200, 'Event updated successfully', updatedEvent);
  } catch (error) {
    logger.error('[updateEvent] Error:', error);
    
    // Enhanced error logging for validation errors
    if (error.name === 'ValidationError') {
      logger.error('[updateEvent] Validation Error Details:', JSON.stringify(error.errors, null, 2));
      
      // Log specific field validation errors
      Object.keys(error.errors).forEach(field => {
        const fieldError = error.errors[field];
        logger.error(`[updateEvent] Field '${field}' validation error:`, {
          message: fieldError.message,
          value: fieldError.value,
          path: fieldError.path,
          kind: fieldError.kind
        });
      });
    }
    
    return sendSuccess(res, 400, error.message);
  }
});

/**
 * Archive event (soft delete by changing status to archived)
 * @route PATCH /api/events/:id/archive
 * @access Private
 */
const archiveEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req?.params?.id);
  
  if (!event) {
    return sendSuccess(res, 404, 'Event not found');
  }
  
  // Soft delete by changing status
  event.status = 'archived';
  event.updatedAt = new Date();
  await event.save();
  
  return sendSuccess(res, 200, 'Event archived successfully');
});

/**
 * Permanently delete event
 * @route DELETE /api/events/:id
 * @access Private (Admin only)
 */
/**
 * Schedule event for deletion with PurpleHat Advanced Security Protocol
 * @route DELETE /api/events/:id
 * @access Private (Admin only)
 */
const deleteEvent = asyncHandler(async (req, res) => {
  const eventId = req?.params?.id;
  const userId = req?.user?.id;
  const { forceImmediate = false, gracePeriodHours = 1 } = req.body;
  
  if (!mongoose?.Types?.ObjectId.isValid(eventId)) {
    return sendSuccess(res, 400, 'Invalid event ID format');
  }
  
  // Check if event exists
  const event = await Event.findById(eventId);
  if (!event) {
    return sendSuccess(res, 404, 'Event not found');
  }
  
  try {
    const EventDeletionScheduler = require('../models/EventDeletionScheduler');
    const EventDeletionService = require('../services/EventDeletionService');
    const AuditLogService = require('../services/AuditLogService');
    const Registration = require('../models/Registration');
    
    // Check if already scheduled for deletion
    const existingSchedule = await EventDeletionScheduler.findOne({
      event: eventId,
      status: 'scheduled',
      isDeleted: false
    });
    
    if (existingSchedule) {
      return sendSuccess(res, 400, 'Event is already scheduled for deletion', {
        scheduledAt: existingSchedule.scheduledAt,
        executeAt: existingSchedule.executeAt,
        remainingTime: existingSchedule.getRemainingTimeFormatted(),
        canCancel: existingSchedule.canBeCancelled()
      });
    }
    
    // Clean up any cancelled/completed deletion records for this event to avoid duplicate key errors
    await EventDeletionScheduler.deleteMany({
      event: eventId,
      status: { $in: ['cancelled', 'completed', 'failed'] }
    });
    
    logger.info(`🧹 Cleaned up old deletion records for event ${eventId}`);
    
    // Perform safety validation
    const deletionService = new EventDeletionService();
    const safetyCheck = await deletionService.validateDeletionSafety(eventId);
    
    // Get registration count for metadata
    const registrationCount = await Registration.countDocuments({ event: eventId });
    
    // For force immediate deletion (admin override)
    if (forceImmediate && req.user?.role === 'admin') {
      logger.info(`🚨 FORCE DELETE initiated by admin for event: ${event.name} (${eventId})`);
      
      const deletionStats = await deletionService.cascadeDeleteEvent(eventId, {
        dryRun: false,
        skipBackup: false
      });
      
      // Audit log the force deletion
      await AuditLogService.logForceDeletion(event, req.user, deletionStats, req);
      
      return sendSuccess(res, 200, 'Event permanently deleted immediately', {
        message: 'Event and ALL related data have been permanently deleted',
        deletionStats,
        warnings: ['⚠️ IMMEDIATE DELETION - No grace period applied']
      });
    }
    
    // Schedule deletion with grace period (normal flow)
    const scheduledDeletion = new EventDeletionScheduler({
      event: eventId,
      eventMetadata: {
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        venue: {
          name: event.venue?.name,
          address: event.venue?.address,
          city: event.venue?.city,
          country: event.venue?.country
        },
        registrationCount,
        description: event.description
      },
      initiatedBy: userId,
      initiatorDetails: {
        name: req.user?.name || 'Unknown',
        email: req.user?.email || 'Unknown',
        role: req.user?.role || 'Unknown'
      },
      gracePeriodHours: Math.max(0.1, Math.min(168, gracePeriodHours)), // 6min to 1 week
      securityChecks: {
        ...safetyCheck.checks,
        checksPerformedAt: new Date()
      },
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress,
      sessionId: req.sessionID
    });
    
    await scheduledDeletion.save();
    
    // Send immediate scheduled notification
    await AuditLogService.logDeletionScheduled(event, req.user, scheduledDeletion, req);
    
    // Immediate notification - mark as sent
    scheduledDeletion.notificationsSent.scheduled = true;
    await scheduledDeletion.save();
    
    logger.info(`🔒 Event deletion scheduled: ${event.name} (${eventId}) - Execution at: ${scheduledDeletion.executeAt}`);
    logger.warn(`📧 DELETION SCHEDULED NOTIFICATION: Event "${event.name}" scheduled for deletion at ${scheduledDeletion.executeAt}`);
    logger.info(`⏰ TIMER STARTED: ${scheduledDeletion.getRemainingTimeFormatted()} remaining until permanent deletion`);
    
    // Optional: Send WebSocket notification to connected clients
    if (req.app.locals.io) {
      req.app.locals.io.emit('deletionScheduled', {
        eventId,
        eventName: event.name,
        executeAt: scheduledDeletion.executeAt,
        remainingTime: scheduledDeletion.getRemainingTimeFormatted()
      });
    }
    
    return sendSuccess(res, 200, 'Event scheduled for deletion with security lockdown', {
      message: `Event "${event.name}" is scheduled for permanent deletion`,
      scheduledAt: scheduledDeletion.scheduledAt,
      executeAt: scheduledDeletion.executeAt,
      gracePeriodHours: scheduledDeletion.gracePeriodHours,
      remainingTime: scheduledDeletion.getRemainingTimeFormatted(),
      schedulerId: scheduledDeletion._id,
      canCancel: true,
      safetyChecks: safetyCheck.checks,
      warnings: [
        '🚨 PERMANENT DELETION SCHEDULED',
        '⚠️  ALL event data will be permanently deleted',
        '⚠️  This action cannot be undone after execution',
        `🕐 Grace period: ${scheduledDeletion.gracePeriodHours} hour(s)`,
        '✋ You can cancel this deletion before execution',
        ...safetyCheck.warnings
      ]
    });
    
  } catch (error) {
    logger.error(`Error scheduling event deletion: ${error.message}`);
    return sendSuccess(res, 500, 'Failed to schedule event deletion', null, { 
      error: error.message 
    });
  }
});

/**
 * Cancel scheduled event deletion
 * @route POST /api/events/:id/cancel-deletion
 * @access Private
 */
const cancelEventDeletion = asyncHandler(async (req, res) => {
  const eventId = req?.params?.id;
  const userId = req?.user?.id;
  const { reason = 'Cancelled by user' } = req.body;
  
  if (!mongoose?.Types?.ObjectId.isValid(eventId)) {
    return sendSuccess(res, 400, 'Invalid event ID format');
  }
  
  try {
    const EventDeletionScheduler = require('../models/EventDeletionScheduler');
    const AuditLogService = require('../services/AuditLogService');
    
    const scheduledDeletion = await EventDeletionScheduler.findOne({
      event: eventId,
      status: 'scheduled',
      isDeleted: false
    });
    
    if (!scheduledDeletion) {
      return sendSuccess(res, 404, 'No scheduled deletion found for this event');
    }
    
    if (!scheduledDeletion.canBeCancelled()) {
      return sendSuccess(res, 400, 'Deletion cannot be cancelled - grace period has expired or deletion is in progress');
    }
    
    await scheduledDeletion.cancel(userId, reason);
    
    // Audit log the cancellation
    await AuditLogService.logDeletionCancelled(scheduledDeletion, req.user, reason);
    
    logger.info(`✅ Event deletion cancelled: ${scheduledDeletion.eventMetadata.name} (${eventId})`);
    
    return sendSuccess(res, 200, 'Event deletion cancelled successfully', {
      message: `Deletion of "${scheduledDeletion.eventMetadata.name}" has been cancelled`,
      cancelledAt: scheduledDeletion.cancelledAt,
      reason: scheduledDeletion.cancellationReason,
      cancelledBy: userId
    });
    
  } catch (error) {
    logger.error(`Error cancelling event deletion: ${error.message}`);
    return sendSuccess(res, 500, 'Failed to cancel event deletion', null, { 
      error: error.message 
    });
  }
});

/**
 * Get deletion status for an event
 * @route GET /api/events/:id/deletion-status
 * @access Private
 */
const getEventDeletionStatus = asyncHandler(async (req, res) => {
  const eventId = req?.params?.id;
  
  if (!mongoose?.Types?.ObjectId.isValid(eventId)) {
    return sendSuccess(res, 400, 'Invalid event ID format');
  }
  
  try {
    const EventDeletionScheduler = require('../models/EventDeletionScheduler');
    
    const scheduledDeletion = await EventDeletionScheduler.findOne({
      event: eventId,
      isDeleted: false
    }).populate('initiatedBy cancelledBy', 'name email role');
    
    if (!scheduledDeletion) {
      return sendSuccess(res, 200, 'No deletion scheduled', {
        hasScheduledDeletion: false,
        status: 'active'
      });
    }
    
    const status = {
      hasScheduledDeletion: true,
      status: scheduledDeletion.status,
      scheduledAt: scheduledDeletion.scheduledAt,
      executeAt: scheduledDeletion.executeAt,
      remainingTime: scheduledDeletion.getRemainingTime(),
      remainingTimeFormatted: scheduledDeletion.getRemainingTimeFormatted(),
      canCancel: scheduledDeletion.canBeCancelled(),
      gracePeriodHours: scheduledDeletion.gracePeriodHours,
      initiatedBy: scheduledDeletion.initiatedBy,
      securityChecks: scheduledDeletion.securityChecks,
      eventMetadata: scheduledDeletion.eventMetadata
    };
    
    if (scheduledDeletion.status === 'cancelled') {
      status.cancelledAt = scheduledDeletion.cancelledAt;
      status.cancellationReason = scheduledDeletion.cancellationReason;
      status.cancelledBy = scheduledDeletion.cancelledBy;
    }
    
    if (scheduledDeletion.status === 'completed') {
      status.executionCompletedAt = scheduledDeletion.executionCompletedAt;
      status.deletionStats = scheduledDeletion.deletionStats;
    }
    
    return sendSuccess(res, 200, 'Deletion status retrieved', status);
    
  } catch (error) {
    logger.error(`Error getting deletion status: ${error.message}`);
    return sendSuccess(res, 500, 'Failed to get deletion status', null, { 
      error: error.message 
    });
  }
});

/**
 * Get event dashboard data
 * @route GET /api/events/:id/dashboard
 * @access Private
 */
const getEventDashboard = asyncHandler(async (req, res) => {
  try {
    const eventId = req?.params?.id;
    logger.info(`Fetching dashboard for event ID: ${eventId}`);
    
    // Define default dashboard data
    const defaultDashboardData = {
      event: { 
        name: 'Unknown Event', 
        startDate: new Date(), 
        endDate: new Date() 
      },
      stats: {
        registrationsCount: 0,
        checkedInCount: 0,
        resourcesCount: 0,
        checkInRate: 0
      }
    };
    
    // Validate MongoDB ObjectID format
    if (!mongoose?.Types?.ObjectId.isValid(eventId)) {
      logger.info('Invalid ObjectID format');
      return res.status(200).json({
        success: true,
        message: 'Dashboard data (invalid ID format)',
        data: defaultDashboardData
      });
    }
    
    // Get event safely
    let event = null;
    try {
      event = await Event.findById(eventId);
    } catch (error) {
      logger.error(`Error finding event: ${findError.message}`);
    }
    
    if (!event) {
      logger.info(`Event not found: ${eventId}`);
      return res.status(200).json({
        success: true,
        message: 'Dashboard data (event not found)',
        data: defaultDashboardData
      });
    }
    
    // Get counts safely
    let stats = {
      registrationsCount: 0,
      checkedInCount: 0,
      resourcesCount: 0,
      checkInRate: 0
    };
    
    try {
      // Get registrations count
      stats.registrationsCount = await Registration.countDocuments({ event: eventId });
      
      // Get checked-in count
      stats.checkedInCount = await Registration.countDocuments({
        event: eventId,
        'checkIn.isCheckedIn': true
      });
      
      // Get resources count
      stats.resourcesCount = await Resource.countDocuments({ event: eventId });
      
      // Calculate check-in rate
      stats.checkInRate = stats.registrationsCount > 0
        ? Math.round((stats.checkedInCount / stats.registrationsCount) * 100)
        : 0;
    } catch (error) {
      logger.error(`Error getting counts: ${countError.message}`);
      // Stats will keep default values of 0
    }
    
    // --- Recent Activities (simple implementation) ---
    const recentResources = await Resource.find({ event: eventId, $or: [{ isVoided: false }, { isVoided: { $exists: false } }] })
      .sort({ actionDate: -1 })
      .limit(10)
      .lean();

    const recentRegistrations = await Registration.find({ event: eventId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const recentActivities = [];

    recentRegistrations.forEach((reg) => {
      recentActivities.push({
        type: 'registration',
        details: `Registration ${reg.registrationId || reg._id} created`,
        timestamp: reg.createdAt || reg.updatedAt || new Date()
      });
    });

    recentResources.forEach((res) => {
      const name = res.resourceOptionName || res.details?.option || res.type;
      recentActivities.push({
        type: res.type || 'resource',
        details: `${name} ${res.status || ''}`.trim(),
        timestamp: res.actionDate || res.createdAt || new Date()
      });
    });

    // Sort combined activities by timestamp desc and cap to 20
    recentActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const trimmedActivities = recentActivities.slice(0, 20);

    const dashboardData = {
      event,
      stats,
      recentActivities: trimmedActivities
    };
    
    return res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data: dashboardData
    });
  } catch (error) {
    logger.error(`Error in getEventDashboard: ${error.message}`);
    logger.error(error.stack);
    
    // Return default data on error
    return res.status(200).json({
      success: true,
      message: 'Error fetching dashboard, returning default data',
      data: {
        event: { name: 'Unknown Event', startDate: new Date(), endDate: new Date() },
        stats: {
          registrationsCount: 0,
          checkedInCount: 0,
          resourcesCount: 0,
          checkInRate: 0
        }
      }
    });
  }
});

/**
 * Get event statistics using Aggregation Pipelines
 * @route GET /api/events/:id/statistics
 * @access Private
 */
const getEventStatistics = asyncHandler(async (req, res) => {
  try {
    const eventId = req?.params?.id;
    if (!mongoose?.Types?.ObjectId.isValid(eventId)) {
      // Return consistent default structure on bad ID
      return sendSuccess(res, 400, 'Invalid Event ID format', {
        registrations: { total: 0, checkedIn: 0, byDay: [], byCategory: {} },
        resources: { food: { total: 0 }, kitBag: { total: 0 }, certificates: { total: 0 } }
      });
    }
    const eventObjectId = new mongoose.Types.ObjectId(eventId);

    // Optional: Check if event exists first to potentially return faster
    const eventExists = await Event.findById(eventObjectId).select('_id').lean();
    if (!eventExists) {
      return sendSuccess(res, 200, 'Event statistics (event not found)', {
         registrations: { total: 0, checkedIn: 0, byDay: [], byCategory: {} },
         resources: { food: { total: 0 }, kitBag: { total: 0 }, certificates: { total: 0 } }
      });
    }

    // --- Registration Aggregation ---
    const registrationStatsPipeline = [
      { $match: { event: eventObjectId } },
      {
        $group: {
          _id: '$category', // Group by category ID first
          totalInCategory: { $sum: 1 },
          checkedInInCategory: {
            $sum: { $cond: ['$checkIn.isCheckedIn', 1, 0] }
          },
          printedInCategory: {
            $sum: { $cond: ['$badgePrinted', 1, 0] }
          },
          // Collect check-in dates within each category group
          checkInDates: {
             $push: {
               $cond: [
                 { $and: ['$checkIn.isCheckedIn', '$checkIn.checkedInAt'] },
                 { $dateToString: { format: '%Y-%m-%d', date: '$checkIn.checkedInAt' } },
                 '$$REMOVE'
               ]
             }
          }
        }
      },
      // Lookup Category Details
      {
        $lookup: {
          from: 'categories',
          localField: '_id', // Category ID from grouping
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      {
        $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: true } // Keep results even if category doc is missing
      },
      // Group again to consolidate overall totals and daily check-ins across categories
      {
         $group: {
             _id: null, // Group all documents together
             totalRegistrations: { $sum: '$totalInCategory' },
             totalCheckedIn: { $sum: '$checkedInInCategory' },
             totalPrinted: { $sum: '$printedInCategory' },
             // Collect stats per category
             categoriesData: {
                 $push: {
                     name: { $ifNull: ['$categoryDetails.name', 'Uncategorized'] },
                     count: '$totalInCategory',
                     checkedIn: '$checkedInInCategory',
                     printed: '$printedInCategory'
                 }
             },
             // Flatten all check-in dates into a single array
             allCheckInDates: { $push: '$checkInDates' }
         }
      },
      // Further processing needed in JS for daily counts
      {
        $project: {
          _id: 0, // Exclude the default _id
          totalRegistrations: 1,
          totalCheckedIn: 1,
          totalPrinted: 1,
          categoriesData: 1,
          // Flatten the array of arrays of dates
          allCheckInDates: {
             $reduce: {
                input: "$allCheckInDates",
                initialValue: [],
                in: { $concatArrays: ["$$value", "$$this"] }
             }
          }
        }
      }
    ];

    const registrationAggResult = await Registration.aggregate(registrationStatsPipeline);
    const regStats = registrationAggResult[0] || { totalRegistrations: 0, totalCheckedIn: 0, categoriesData: [], allCheckInDates: [] }; // Default if no registrations

    // --- Process Aggregated Registration Stats ---
    const categoryCounts = {};
    regStats?.categoriesData?.forEach(cat => {
      categoryCounts[cat.name] = cat.count;
    });

    const combinedCheckInsByDay = {};
    regStats?.allCheckInDates?.forEach(day => {
      if (day) { // Ensure day is not null/undefined
        combinedCheckInsByDay[day] = (combinedCheckInsByDay[day] || 0) + 1;
      }
    });

    // --- Resource Aggregation ---
    const resourceStatsPipeline = [
       // Ensure we only match documents with a non-null and valid resourceType
       { 
         $match: { 
           event: eventObjectId, 
           void: { $ne: true },
           resourceType: { $ne: null, $in: ['food', 'kitBag', 'certificate'] } // Add check for non-null and known types
         } 
       },
       {
          $group: {
             _id: '$resourceType', // Group by food, kitBag, certificate
             count: { $sum: 1 }
          }
       },
       { // Reshape the output
          $group: {
             _id: null,
             stats: { $push: { k: '$_id', v: '$count' } }
          }
       },
       {
          $replaceRoot: { newRoot: { $arrayToObject: '$stats' } }
       }
    ];

    const resourceAggResult = await Resource.aggregate(resourceStatsPipeline);
    const resourceCounts = resourceAggResult[0] || {}; // Result is { food: X, kitBag: Y, certificate: Z }

    // --- Assemble Final Response ---
    const responseData = {
      registrations: {
        total: regStats.totalRegistrations,
        checkedIn: regStats.totalCheckedIn,
        printed: regStats.totalPrinted,
        byDay: Object.entries(combinedCheckInsByDay).map(([date, count]) => ({ date, count })).sort((a, b) => a?.date?.localeCompare(b.date)), // Sort by date
        byCategory: categoryCounts,
        categoriesDetailed: regStats.categoriesData // each with name,count,checkedIn,printed
      },
      // Provide categoriesDetailed at top-level for convenience
      categoriesDetailed: regStats.categoriesData,
      resources: { // Structure matches frontend expectation? Check EventPortal.jsx if needed
        food: { total: resourceCounts.food || 0 },
        kitBag: { total: resourceCounts.kitBag || 0 }, // Ensure key matches frontend if different
        certificates: { total: resourceCounts.certificate || 0 }
      }
    };
    
    // Debug log
    console.info('[getEventStatistics] Registration stats:', JSON.stringify(regStats, null, 2));
    console.info('[getEventStatistics] Resource counts:', JSON.stringify(resourceCounts, null, 2));
    
    return sendSuccess(res, 200, 'Event statistics retrieved successfully', responseData);

  } catch (error) {
    logger.error(`Error in getEventStatistics: ${error.message}`);
    logger.error(error.stack); // Log stack for detailed debugging
    // Return consistent default structure on error
    return sendSuccess(res, 500, 'Failed to fetch event statistics', {
        registrations: { total: 0, checkedIn: 0, byDay: [], byCategory: {} },
        resources: { food: { total: 0 }, kitBag: { total: 0 }, certificates: { total: 0 } }
    }, { error: error.message });
  }
});

/**
 * @desc    Get registration counts by category for an event
 * @route   GET /api/events/:eventId/registrations/counts-by-category
 * @access  Private
 */
// Define as const first
const getRegistrationCountsByCategory = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;

  if (!mongoose?.Types?.ObjectId.isValid(eventId)) {
    return next(createApiError(400, 'Invalid Event ID format'));
  }

  try {
    const counts = await Registration.aggregate([
      {
        $match: { event: new mongoose.Types.ObjectId(eventId) }
      },
      {
        $group: {
          _id: '$category', // Group by category ID
          count: { $sum: 1 } // Count registrations in each group
        }
      },
      {
        $lookup: {
          from: 'categories', // Join with the categories collection
          localField: '_id',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      {
        $unwind: {
          path: '$categoryDetails',
          preserveNullAndEmptyArrays: true // Keep groups even if category is deleted/not found
        }
      },
      {
        $project: {
          _id: 0,
          categoryId: '$_id',
          categoryName: { $ifNull: ['$categoryDetails.name', 'Uncategorized'] }, // Use name or 'Uncategorized'
          count: 1
        }
      }
    ]);

    StandardErrorHandler.sendSuccess(res, 200, 'Operation successful', counts
    );

  } catch (error) {
    logger.error(`Error getting registration counts by category for event ${eventId}:`, error);
    next(createApiError(500, 'Server error while fetching registration counts'));
  }
});

/**
 * @desc    Get badge settings for an event
 * @route   GET /api/events/:id/badge-settings
 * @access  Private
 */
const getBadgeSettings = asyncHandler(async (req, res) => {
  try {
    const event = await Event.findById(req?.params?.id);
    
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    const badgeSettings = event.badgeSettings || {
      orientation: 'portrait',
      fields: [] 
    };

    return StandardErrorHandler.sendSuccess(res, 200, 'Operation successful', badgeSettings 
    );
  } catch (error) {
    logger.error('Error fetching badge settings:', error);
    return StandardErrorHandler.sendError(res, 500, 'Failed to fetch badge settings');
  }
});

const updateBadgeSettings = asyncHandler(async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req?.params?.id,
      { badgeSettings: req.body },
      { new: true, runValidators: true }
    );
    
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Badge settings updated', 
      data: event.badgeSettings 
    });
  } catch (error) {
    logger.error('Error updating badge settings:', error);
    return StandardErrorHandler.sendError(res, 500, 'Failed to update badge settings');
  }
});

/**
 * @desc    Get configured resource names for an event
 * @route   GET /api/events/:id/resource-config
 * @access  Private
 */
const getResourceConfig = asyncHandler(async (req, res) => {
  const eventId = req?.params?.id;

  if (!mongoose?.Types?.ObjectId.isValid(eventId)) {
    return sendSuccess(res, 400, 'Invalid event ID format');
  }

  // Fetch ResourceSettings for each type
  const types = [
    { type: 'food', key: 'meals' },
    { type: 'kitBag', key: 'kitItems' },
    { type: 'certificate', key: 'certificates' }
  ];
  const config = {};
  for (const { type, key } of types) {
    const resourceSetting = await ResourceSetting.findOne({ event: eventId, type });
    if (resourceSetting && resourceSetting.settings) {
      if (type === 'food') {
        config[key] = (resourceSetting?.settings?.meals || []).map(item => ({ id: item._id?.toString?.() || item.id || item, name: item.name || item.label || item }));
      } else if (type === 'kitBag') {
        config[key] = (resourceSetting?.settings?.items || []).map(item => ({ id: item._id?.toString?.() || item.id || item, name: item.name || item.label || item }));
      } else if (type === 'certificate') {
        config[key] = (resourceSetting?.settings?.types || []).map(item => ({ id: item._id?.toString?.() || item.id || item, name: item.name || item.label || item }));
      }
    } else {
      config[key] = [];
    }
  }
  return sendSuccess(res, 200, 'Resource configuration retrieved successfully', config);
});

/**
 * Get event resource configurations
 * @route GET /api/events/:id/resource-config
 * @access Private
 */
const getEventResourceConfig = asyncHandler(async (req, res, next) => {
  const eventId = req?.params?.id;

  if (!mongoose?.Types?.ObjectId.isValid(eventId)) {
    return sendSuccess(res, 400, 'Invalid Event ID format');
  }

  // Fetch ResourceSettings for each type
  const types = [
    { type: 'food', field: 'food', defaultSettings: { enabled: false, meals: [], days: [] } },
    { type: 'kitBag', field: 'kits', defaultSettings: { enabled: false, items: [] } },
    { type: 'certificate', field: 'certificates', defaultSettings: { enabled: false, types: [] } }
  ];
  const resourceConfig = {};
  for (const { type, field, defaultSettings } of types) {
    const resourceSetting = await ResourceSetting.findOne({ event: eventId, type });
    let settings = resourceSetting ? resourceSetting.settings : defaultSettings;
    resourceConfig[field] = settings;
  }
  return sendSuccess(res, 200, 'Resource configuration retrieved successfully', resourceConfig);
});

// Abstract Settings
const getAbstractSettings = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info(`Getting abstract settings for event ${id}`);
    
    if (!id) {
      return StandardErrorHandler.sendError(res, 400, 'Event ID is required');
    }
    
    // Find the event
    const event = await Event.findById(id);
    
    if (!event) {
      logger.info(`Event not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: `Event not found with ID: ${id}`
      });
    }
    
    logger.info('Retrieved abstract settings:', JSON.stringify(event.abstractSettings || {}));
    
    return res.status(200).json({
      success: true,
      message: 'Abstract settings retrieved successfully',
      data: event.abstractSettings || {}
    });
  } catch (error) {
    logger.error(`Error retrieving abstract settings: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving abstract settings',
      error: error.message
    });
  }
});

const updateAbstractSettings = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { settings  } = req.body || {};
    if (!req.body) {
      return StandardErrorHandler.sendError(res, 400, 'Request body is required');
    };
    
    logger.info('--- [DEBUG] updateAbstractSettings called ---');
    logger.info(`[DEBUG] Incoming event ID:`, id);
    logger.info(`[DEBUG] Incoming settings:`, JSON.stringify(settings, null, 2));
    
    if (!id) {
      return StandardErrorHandler.sendError(res, 400, 'Event ID is required');
    }
    
    if (!settings) {
      return StandardErrorHandler.sendError(res, 400, 'Abstract settings are required');
    }
    
    // Find the event first to check if it exists
    const existingEvent = await Event.findById(id);
    
    if (!existingEvent) {
      logger.info(`[DEBUG] Event not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: `Event not found with ID: ${id}`
      });
    }
    
    logger.info('[DEBUG] Current abstract settings before update:', JSON.stringify(existingEvent.abstractSettings, null, 2));
    
    // Before updating, ensure reviewerIds are ObjectId
    if (settings.categories && Array.isArray(settings.categories)) {
      settings.categories = settings?.categories?.map(cat => {
        logger.info(`[DEBUG] Category: ${cat.name} - reviewerIds before:`, cat.reviewerIds);
        if (cat.reviewerIds && Array.isArray(cat.reviewerIds)) {
          cat.reviewerIds = cat.reviewerIds
            .filter(id => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));
        }
        logger.info(`[DEBUG] Category: ${cat.name} - reviewerIds after:`, cat.reviewerIds);
        return cat;
      });
    }
    
    // Update the event with the new abstract settings
    const event = await Event.findByIdAndUpdate(
      id,
      { $set: { abstractSettings: settings } },
      { new: true, runValidators: true }
    );
    
    if (!event) {
      logger.info(`[DEBUG] Failed to update event with ID: ${id}`);
      return res.status(500).json({
        success: false,
        message: `Failed to update event with ID: ${id}`
      });
    }
    
    logger.info('[DEBUG] Updated abstract settings:', JSON.stringify(event.abstractSettings, null, 2));
    if (event.abstractSettings && Array.isArray(event?.abstractSettings?.categories)) {
      event?.abstractSettings?.categories.forEach(cat => {
        logger.info(`[DEBUG] Category: ${cat.name} - reviewerIds in DB:`, cat.reviewerIds);
      });
    }
    
    // Save the event to ensure the changes are persisted
    await event.save();
    
    logger.info('[DEBUG] Event saved successfully with updated abstract settings');
    
    return res.status(200).json({
      success: true,
      message: 'Abstract settings updated successfully',
      data: event.abstractSettings
    });
  } catch (error) {
    logger.error(`[DEBUG] Error updating abstract settings: ${error.message}`);
    logger.error(error.stack);
    return res.status(500).json({
      success: false,
      message: 'Error updating abstract settings',
      error: error.message
    });
  }
});

// Email Settings
const getEmailSettings = asyncHandler(async (req, res) => {
  try {
    const event = await Event.findById(req?.params?.id).select('emailSettings');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    return res.status(200).json({ 
      success: true, 
      data: event.emailSettings || {} 
    });
  } catch (error) {
    logger.error('Error fetching email settings:', error);
    return StandardErrorHandler.sendError(res, 500, 'Failed to fetch email settings');
  }
});

const updateEmailSettings = asyncHandler(async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req?.params?.id,
      { emailSettings: req.body },
      { new: true, runValidators: true }
    ).select('emailSettings');
    
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    return res.status(200).json({ 
      success: true, 
      message: 'Email settings updated', 
      data: event.emailSettings 
    });
  } catch (error) {
    logger.error('Error updating email settings:', error);
    return StandardErrorHandler.sendError(res, 500, 'Failed to update email settings');
  }
});

// Portal Settings
const getPortalSettings = asyncHandler(async (req, res) => {
  try {
    const event = await Event.findById(req?.params?.id).select('portalSettings');
    if (!event) {
      return sendSuccess(res, 404, 'Event not found'); // Using sendSuccess for consistency
    }
    const settings = event.portalSettings || {}; 
    return sendSuccess(res, 200, 'Portal settings retrieved', settings);
  } catch (error) {
    logger.error(`Error fetching portal settings for event ${req?.params?.id}:`, error);
    return createApiError(500, 'Failed to retrieve portal settings'); // Using createApiError for consistency
  }
});

const updatePortalSettings = asyncHandler(async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req?.params?.id,
      { $set: { portalSettings: req.body } },
      { new: true, runValidators: true }
    ).select('portalSettings');

    if (!event) {
      return sendSuccess(res, 404, 'Event not found');
    }
    return sendSuccess(res, 200, 'Portal settings updated', event.portalSettings);
  } catch (error) {
    logger.error(`Error updating portal settings: ${error.message}`);
    return createApiError(500, 'Failed to update portal settings');
  }
});

/**
 * @desc    Get list of potential reviewers (users with role 'reviewer' and associated with the event)
 * @route   GET /api/events/:eventId/abstract-workflow/reviewers
 * @access  Protected (Admin/Staff)
 */
const getEventReviewers = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;

  // EXTENSIVE LOGGING START
  logger.info('--- [getEventReviewers] ---');
  logger.info('Request path:', req.originalUrl);
  logger.info('User state:', req.user ? {
    id: req?.user?._id,
    email: req?.user?.email,
    role: req?.user?.role,
    isActive: req?.user?.isActive
  } : 'No user found');
  logger.info('Headers:', req.headers);
  logger.info('Raw eventId:', eventId, 'Type:', typeof eventId);

  if (!eventId) {
    logger.info('Event ID missing in params');
    return next(createApiError('Event ID is required', 400));
  }

  let eventObjectId;
  try {
    eventObjectId = new mongoose.Types.ObjectId(eventId);
    logger.info('Converted eventId to ObjectId:', eventObjectId, 'Type:', typeof eventObjectId);
  } catch (error) {
    logger.info('Invalid Event ID format:', eventId, e);
    return next(createApiError('Invalid Event ID format', 400));
  }

  // Support both legacy managedEvents and new eventRoles structure
  const query = {
    role: 'reviewer',
    $or: [
      { managedEvents: { $in: [eventObjectId] } },
      { eventRoles: { $elemMatch: { eventId: eventObjectId, role: 'reviewer' } } }
    ]
  };
  logger.info('MongoDB Query:', JSON.stringify(query));

  // Fetch users with the 'reviewer' role and associated with the event
  const reviewers = await User.find(query).select('name email managedEvents eventRoles role');

  logger.info('Raw reviewers result:', reviewers);
  if (Array.isArray(reviewers)) {
    reviewers.forEach((r, i) => {
      logger.info(`Reviewer[${i}]:`, {
        _id: r._id,
        name: r.name,
        email: r.email,
        managedEvents: r.managedEvents,
        eventRoles: r.eventRoles,
        role: r.role
      });
    });
  }
  logger.info('Found reviewers count:', reviewers && reviewers.length);

  if (!reviewers || reviewers.length === 0) {
    logger.info('No reviewers found for event:', eventId);
    return next(createApiError(404, 'No reviewers found for this event'));
  }

  logger.info('Returning reviewers:', reviewers.map(r => r.email));
  sendSuccess(res, 200, 'Reviewers retrieved successfully', reviewers);
  logger.info('--- [getEventReviewers END] ---');
});

// =====================================================
// NEW: Component-Based Event Management Functions
// =====================================================

/**
 * @desc    Get component-based registration configuration for an event
 * @route   GET /api/events/:id/component-config
 * @access  Private (Admin/Staff)
 */
const getComponentConfig = asyncHandler(async (req, res) => {
  try {
    const event = await Event.findById(req?.params?.id).select('registrationComponents');
    if (!event) {
      return sendSuccess(res, 404, 'Event not found');
    }
    
    const config = event.registrationComponents || {
      enabled: false,
      dailyConfiguration: { enabled: false, days: [] },
      workshopComponents: [],
      sessionComponents: [],
      packageDeals: []
    };
    
    return sendSuccess(res, 200, 'Component configuration retrieved successfully', config);
  } catch (error) {
    logger.error('Error fetching component configuration:', error);
    return sendSuccess(res, 500, 'Failed to fetch component configuration');
  }
});

/**
 * @desc    Update component-based registration configuration for an event
 * @route   PUT /api/events/:id/component-config
 * @access  Private (Admin/Staff)
 */
const updateComponentConfig = asyncHandler(async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req?.params?.id,
      { $set: { registrationComponents: req.body } },
      { new: true, runValidators: true }
    ).select('registrationComponents');
    
    if (!event) {
      return sendSuccess(res, 404, 'Event not found');
    }
    
    return sendSuccess(res, 200, 'Component configuration updated successfully', event.registrationComponents);
  } catch (error) {
    logger.error('Error updating component configuration:', error);
    return sendSuccess(res, 500, 'Failed to update component configuration', null, { error: error.message });
  }
});

/**
 * @desc    Enable/disable component-based registration for an event
 * @route   PATCH /api/events/:id/component-config/toggle
 * @access  Private (Admin/Staff)
 */
const toggleComponentRegistration = asyncHandler(async (req, res) => {
  try {
    const { enabled  } = req.body || {};
    if (!req.body) {
      return StandardErrorHandler.sendError(res, 400, 'Request body is required');
    };
    
    const event = await Event.findByIdAndUpdate(
      req?.params?.id,
      { $set: { 'registrationComponents.enabled': enabled } },
      { new: true, runValidators: true }
    ).select('registrationComponents');
    
    if (!event) {
      return sendSuccess(res, 404, 'Event not found');
    }
    
    const message = enabled ? 
      'Component-based registration enabled successfully' : 
      'Component-based registration disabled successfully';
    
    return sendSuccess(res, 200, message, { enabled: event?.registrationComponents?.enabled });
  } catch (error) {
    logger.error('Error toggling component registration:', error);
    return sendSuccess(res, 500, 'Failed to toggle component registration');
  }
});

/**
 * @desc    Add/update daily configuration for component-based registration
 * @route   PUT /api/events/:id/component-config/daily
 * @access  Private (Admin/Staff)
 */
const updateDailyConfiguration = asyncHandler(async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req?.params?.id,
      { $set: { 'registrationComponents.dailyConfiguration': req.body } },
      { new: true, runValidators: true }
    ).select('registrationComponents.dailyConfiguration');
    
    if (!event) {
      return sendSuccess(res, 404, 'Event not found');
    }
    
    return sendSuccess(res, 200, 'Daily configuration updated successfully', event?.registrationComponents?.dailyConfiguration);
  } catch (error) {
    logger.error('Error updating daily configuration:', error);
    return sendSuccess(res, 500, 'Failed to update daily configuration', null, { error: error.message });
  }
});

/**
 * @desc    Add/update workshop components for an event
 * @route   PUT /api/events/:id/component-config/workshops
 * @access  Private (Admin/Staff)
 */
const updateWorkshopComponents = asyncHandler(async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req?.params?.id,
      { $set: { 'registrationComponents.workshopComponents': req.body } },
      { new: true, runValidators: true }
    ).select('registrationComponents.workshopComponents');
    
    if (!event) {
      return sendSuccess(res, 404, 'Event not found');
    }
    
    return sendSuccess(res, 200, 'Workshop components updated successfully', event?.registrationComponents?.workshopComponents);
  } catch (error) {
    logger.error('Error updating workshop components:', error);
    return sendSuccess(res, 500, 'Failed to update workshop components', null, { error: error.message });
  }
});

/**
 * @desc    Add/update session components for an event
 * @route   PUT /api/events/:id/component-config/sessions
 * @access  Private (Admin/Staff)
 */
const updateSessionComponents = asyncHandler(async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req?.params?.id,
      { $set: { 'registrationComponents.sessionComponents': req.body } },
      { new: true, runValidators: true }
    ).select('registrationComponents.sessionComponents');
    
    if (!event) {
      return sendSuccess(res, 404, 'Event not found');
    }
    
    return sendSuccess(res, 200, 'Session components updated successfully', event?.registrationComponents?.sessionComponents);
  } catch (error) {
    logger.error('Error updating session components:', error);
    return sendSuccess(res, 500, 'Failed to update session components', null, { error: error.message });
  }
});

/**
 * @desc    Add/update package deals for an event
 * @route   PUT /api/events/:id/component-config/packages
 * @access  Private (Admin/Staff)
 */
const updatePackageDeals = asyncHandler(async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req?.params?.id,
      { $set: { 'registrationComponents.packageDeals': req.body } },
      { new: true, runValidators: true }
    ).select('registrationComponents.packageDeals');
    
    if (!event) {
      return sendSuccess(res, 404, 'Event not found');
    }
    
    return sendSuccess(res, 200, 'Package deals updated successfully', event?.registrationComponents?.packageDeals);
  } catch (error) {
    logger.error('Error updating package deals:', error);
    return sendSuccess(res, 500, 'Failed to update package deals', null, { error: error.message });
  }
});

/**
 * @desc    Get component-based registration analytics for an event
 * @route   GET /api/events/:id/component-analytics
 * @access  Private (Admin/Staff)
 */
const getComponentAnalytics = asyncHandler(async (req, res) => {
  try {
    const eventId = req?.params?.id;
    
    // Validate event exists and has component registration enabled
    const event = await Event.findById(eventId);
    if (!event) {
      return sendSuccess(res, 404, 'Event not found');
    }
    
    if (!event.isComponentBasedRegistration()) {
      return sendSuccess(res, 200, 'Component-based registration not enabled', {
        enabled: false,
        analytics: null
      });
    }
    
    // Get component-based registrations
    const registrations = await Registration.find({
      event: eventId,
      registrationType: { $in: ['component-based', 'package-deal', 'onsite-component'] }
    });
    
    // Analyze component usage
    const componentStats = {};
    let totalComponentRevenue = 0;
    const packageStats = {};
    
    registrations.forEach(reg => {
      if (reg.registrationComponents && reg?.registrationComponents?.length > 0) {
        reg?.registrationComponents?.forEach(comp => {
          if (!componentStats[comp.componentType]) {
            componentStats[comp.componentType] = {
              count: 0,
              revenue: 0,
              components: {}
            };
          }
          
          componentStats[comp.componentType].count += 1;
          componentStats[comp.componentType].revenue += comp?.finalPrice?.cents || 0;
          
          // Track individual component usage
          const compKey = comp.name || comp.componentType;
          if (!componentStats[comp.componentType].components[compKey]) {
            componentStats[comp.componentType].components[compKey] = {
              count: 0,
              revenue: 0
            };
          }
          componentStats[comp.componentType].components[compKey].count += 1;
          componentStats[comp.componentType].components[compKey].revenue += comp?.finalPrice?.cents || 0;
        });
        
        totalComponentRevenue += reg.amountCents || 0;
      }
      
      // Track package deals
      if (reg.pricing && reg?.pricing?.appliedPackage) {
        if (!packageStats[reg?.pricing?.appliedPackage]) {
          packageStats[reg?.pricing?.appliedPackage] = {
            count: 0,
            revenue: 0
          };
        }
        packageStats[reg?.pricing?.appliedPackage].count += 1;
        packageStats[reg?.pricing?.appliedPackage].revenue += reg.amountCents || 0;
      }
    });
    
    // Calculate daily access patterns
    const dailyAccessStats = {};
    if (event?.registrationComponents?.dailyConfiguration.enabled) {
      event?.registrationComponents?.dailyConfiguration.days.forEach(day => {
        dailyAccessStats[day.dayId] = {
          name: day.name,
          date: day.date,
          registrations: 0,
          revenue: 0
        };
      });
      
      registrations.forEach(reg => {
        if (reg.aggregatedEntitlements && reg?.aggregatedEntitlements?.dayAccess) {
          Object.keys(reg?.aggregatedEntitlements?.dayAccess).forEach(dayId => {
            if (reg?.aggregatedEntitlements?.dayAccess[dayId] && dailyAccessStats[dayId]) {
              dailyAccessStats[dayId].registrations += 1;
              // Note: This is an approximation - we don't have per-day revenue breakdown
              const avgDailyRevenue = (reg.amountCents || 0) / Object.keys(reg?.aggregatedEntitlements?.dayAccess).filter(d => reg?.aggregatedEntitlements?.dayAccess[d]).length;
              dailyAccessStats[dayId].revenue += avgDailyRevenue;
            }
          });
        }
      });
    }
    
    const analytics = {
      enabled: true,
      totalComponentRegistrations: registrations && registrations.length,
      totalComponentRevenue: totalComponentRevenue,
      componentTypeStats: componentStats,
      packageDealStats: packageStats,
      dailyAccessStats: dailyAccessStats,
      averageComponentsPerRegistration: registrations.length > 0 ? 
        registrations.reduce((sum, reg) => sum + (reg.registrationComponents ? reg && reg.registrationComponents && reg.registrationComponents && registrationComponents.length : 0), 0) / registrations && registrations.length : 0
    };
    
    return sendSuccess(res, 200, 'Component analytics retrieved successfully', analytics);
  } catch (error) {
    logger.error('Error fetching component analytics:', error);
    return sendSuccess(res, 500, 'Failed to fetch component analytics', null, { error: error.message });
  }
});

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  cancelEventDeletion,
  getEventDeletionStatus,
  archiveEvent,
  getEventDashboard,
  getEventStatistics,
  getRegistrationCountsByCategory,
  getBadgeSettings,
  getResourceConfig,
  getEventResourceConfig,
  getAbstractSettings,
  updateAbstractSettings,
  getBadgeSettings,
  updateBadgeSettings,
  getEmailSettings,
  updateEmailSettings,
  getPortalSettings,
  updatePortalSettings,
  getEventReviewers,
  getComponentConfig,
  updateComponentConfig,
  toggleComponentRegistration,
  updateDailyConfiguration,
  updateWorkshopComponents,
  updateSessionComponents,
  updatePackageDeals,
  getComponentAnalytics
}; 