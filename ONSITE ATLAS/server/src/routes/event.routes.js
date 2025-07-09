const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, restrict } = require('../middleware/auth.middleware');
const {
  getEvents,
  createEvent,
  getEventById,
  updateEvent,
  deleteEvent,
  cancelEventDeletion,
  getEventDeletionStatus,
  getEventDashboard,
  getEventStatistics,
  getRegistrationCountsByCategory,
  getBadgeSettings,
  getResourceConfig,
  getEventReviewers,
  getEventRegistrantCounts
} = require('../controllers/event.controller');

// Import the new user controller function
const { getUsersForEvent } = require('../controllers/user.controller');

// Import registration controller for public lookup
const { publicRegistrationLookup } = require('../controllers/registration.controller');

// Import the email routes
const emailRoutes = require('./email.routes');

// Import resource blocking routes
const resourceBlockingRoutes = require('./resourceBlocking.routes');

// Route for abstracts settings
router.route('/:id/abstract-settings')
  .put(protect, async (req, res) => {
    try {
      const { id } = req.params;
      const { settings } = req.body;
      
      if (!id) {
        return StandardErrorHandler.sendError(res, 400, 'Event ID is required');
      }
      
      if (!settings) {
        return StandardErrorHandler.sendError(res, 400, 'Abstract settings are required');
      }
      
      // Update the event with the new abstract settings
      const event = await require('../models/Event').findByIdAndUpdate(
        id,
        { $set: { abstractSettings: settings } },
        { new: true, runValidators: true }
      );
      
      if (!event) {
        return res.status(404).json({
          success: false,
          message: `Event not found with ID: ${id}`
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Abstract settings updated successfully',
        data: event.abstractSettings
      });
    } catch (error) {
      logger.error(`Error updating abstract settings: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error updating abstract settings',
        error: error.message
      });
    }
  });

// Other event routes
router.route('/')
  .get(getEvents)
  .post(protect, createEvent);

router.route('/:id')
  .get(getEventById)
  .put(protect, updateEvent)
  .delete(protect, restrict('admin'), deleteEvent);

// New deletion management routes with PurpleHat Advanced Security Protocol
router.route('/:id/cancel-deletion')
  .post(protect, restrict('admin'), cancelEventDeletion);

router.route('/:id/deletion-status')
  .get(protect, getEventDeletionStatus);

router.route('/:id/stats')
  .get(protect, getEventStatistics);

router.route('/:id/dashboard')
  .get(protect, getEventDashboard);

router.route('/:eventId/registrations/counts-by-category')
  .get(protect, getRegistrationCountsByCategory);

// Add route for getting badge settings
router.route('/:id/badge-settings')
  .get(protect, getBadgeSettings);

router.route('/:id/publish')
  .put(protect, restrict('admin', 'staff'), async (req, res) => {
    try {
      const { id } = req.params;
      
      // Find the event
      const Event = require('../models/Event');
      const event = await Event.findById(id);
      
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }
      
      // Check if event is ready to be published
      const validationErrors = [];
      
      if (!event.name || event.name.trim() === '') {
        validationErrors.push('Event name is required');
      }
      
      if (!event.startDate || !event.endDate) {
        validationErrors.push('Event start and end dates are required');
      }
      
      if (new Date(event.startDate) >= new Date(event.endDate)) {
        validationErrors.push('Event start date must be before end date');
      }
      
      if (!event.location || event.location.trim() === '') {
        validationErrors.push('Event location is required');
      }
      
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Event cannot be published due to validation errors',
          errors: validationErrors
        });
      }
      
      // Update event status to published
      event.isPublished = true;
      event.publishedAt = new Date();
      event.publishedBy = req.user.id;
      event.status = 'published';
      
      await event.save();
      
      // Log the publish action
      const logger = require('../utils/logger');
const StandardErrorHandler = require('../utils/standardErrorHandler');
      logger.info(`Event ${event.name} (ID: ${id}) published by user ${req.user.id}`);
      
      return res.status(200).json({
        success: true,
        message: 'Event published successfully',
        data: {
          id: event._id,
          name: event.name,
          isPublished: event.isPublished,
          publishedAt: event.publishedAt,
          status: event.status
        }
      });
      
    } catch (error) {
      logger.error('Error publishing event:', error);
      return res.status(500).json({
        success: false,
        message: 'Error publishing event',
        error: error.message
      });
    }
  });

router.route('/:id/unpublish')
  .put(protect, restrict('admin', 'staff'), async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Find the event
      const Event = require('../models/Event');
      const event = await Event.findById(id);
      
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }
      
      if (!event.isPublished) {
        return StandardErrorHandler.sendError(res, 400, 'Event is not currently published');
      }
      
      // Check if event has active registrations
      const Registration = require('../models/Registration');
      const activeRegistrations = await Registration.countDocuments({
        event: id,
        status: { $in: ['confirmed', 'checked-in'] }
      });
      
      if (activeRegistrations > 0 && !req.body.forceUnpublish) {
        return res.status(400).json({
          success: false,
          message: `Cannot unpublish event with ${activeRegistrations} active registrations. Use forceUnpublish=true to override.`,
          activeRegistrations
        });
      }
      
      // Update event status to unpublished
      event.isPublished = false;
      event.unpublishedAt = new Date();
      event.unpublishedBy = req.user.id;
      event.unpublishReason = reason || 'No reason provided';
      event.status = 'draft';
      
      await event.save();
      
      // Log the unpublish action
      const logger = require('../utils/logger');
      logger.info(`Event ${event.name} (ID: ${id}) unpublished by user ${req.user.id}. Reason: ${reason || 'No reason provided'}`);
      
      return res.status(200).json({
        success: true,
        message: 'Event unpublished successfully',
        data: {
          id: event._id,
          name: event.name,
          isPublished: event.isPublished,
          unpublishedAt: event.unpublishedAt,
          unpublishReason: event.unpublishReason,
          status: event.status,
          affectedRegistrations: activeRegistrations
        }
      });
      
    } catch (error) {
      logger.error('Error unpublishing event:', error);
      return res.status(500).json({
        success: false,
        message: 'Error unpublishing event',
        error: error.message
      });
    }
  });

// Get Event Resource Config
router.get('/:id/resource-config', protect, restrict('admin', 'staff'), getResourceConfig);

// Route to get reviewers for an event's abstract workflow
router.route('/:eventId/abstract-workflow/reviewers')
  .get(protect, restrict('admin', 'staff', 'event-manager'), getEventReviewers);

// Route to get users for a specific event
router.route('/:eventId/users')
  .get(protect, restrict('admin', 'manager', 'staff'), getUsersForEvent);

// Public registration lookup route (no authentication required)
router.route('/:eventId/registrations/public-lookup')
  .post(publicRegistrationLookup);

// Mount the email routes
router.use('/:eventId/emails', emailRoutes);

// Mount resource blocking routes
router.use('/:eventId/registrations/:registrationId/resource-blocking', resourceBlockingRoutes);

module.exports = router; 