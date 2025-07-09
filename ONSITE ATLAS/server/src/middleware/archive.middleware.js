const { Event } = require('../models');
const { sendSuccess } = require('../utils/responseFormatter');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Middleware to check if an event is archived and prevent public access
 * Use this middleware on public routes that should not be accessible for archived events
 */
const checkEventNotArchived = async (req, res, next) => {
  try {
    // Extract event ID from params (could be eventId, id, or slug)
    const eventIdentifier = req.params.eventId || req.params.id || req.params.slug;
    
    if (!eventIdentifier) {
      return sendSuccess(res, 400, 'Event identifier is required');
    }

    let event;
    
    // Check if it's a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(eventIdentifier)) {
      event = await Event.findById(eventIdentifier).select('status name');
    } else {
      // Assume it's a slug - you might need to adjust this based on your slug field
      event = await Event.findOne({ slug: eventIdentifier }).select('status name');
    }

    if (!event) {
      return sendSuccess(res, 404, 'Event not found');
    }

    // Check if event is archived
    if (event.status === 'archived') {
      logger.info(`Access denied to archived event: ${event.name} (${eventIdentifier})`);
      return sendSuccess(res, 403, 'This event is no longer available', null, {
        reason: 'Event has been archived',
        eventStatus: 'archived'
      });
    }

    // Optionally, you might also want to check for other statuses that should block public access
    // For example, draft events might not be publicly accessible
    if (event.status === 'draft') {
      logger.info(`Access denied to draft event: ${event.name} (${eventIdentifier})`);
      return sendSuccess(res, 403, 'This event is not yet available to the public', null, {
        reason: 'Event is in draft status',
        eventStatus: 'draft'
      });
    }

    // Add the event to the request object for use in the next middleware/controller
    req.event = event;
    
    next();
  } catch (error) {
    logger.error('Error in checkEventNotArchived middleware:', error);
    return sendSuccess(res, 500, 'Error checking event status', null, { error: error.message });
  }
};

/**
 * Middleware variant that only checks for archived status (allows draft)
 * Use this when you want to allow draft events but block archived ones
 */
const checkEventNotArchivedOnly = async (req, res, next) => {
  try {
    const eventIdentifier = req.params.eventId || req.params.id || req.params.slug;
    
    if (!eventIdentifier) {
      return sendSuccess(res, 400, 'Event identifier is required');
    }

    let event;
    
    if (mongoose.Types.ObjectId.isValid(eventIdentifier)) {
      event = await Event.findById(eventIdentifier).select('status name');
    } else {
      event = await Event.findOne({ slug: eventIdentifier }).select('status name');
    }

    if (!event) {
      return sendSuccess(res, 404, 'Event not found');
    }

    if (event.status === 'archived') {
      logger.info(`Access denied to archived event: ${event.name} (${eventIdentifier})`);
      return sendSuccess(res, 403, 'This event is no longer available', null, {
        reason: 'Event has been archived',
        eventStatus: 'archived'
      });
    }

    req.event = event;
    next();
  } catch (error) {
    logger.error('Error in checkEventNotArchivedOnly middleware:', error);
    return sendSuccess(res, 500, 'Error checking event status', null, { error: error.message });
  }
};

module.exports = {
  checkEventNotArchived,
  checkEventNotArchivedOnly
}; 