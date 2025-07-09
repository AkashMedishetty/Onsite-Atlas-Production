const express = require('express');
// Enable mergeParams to access parameters from parent routers (like :eventId)
// When mounted under /events/:eventId, this router will have access to req.params.eventId
const router = express.Router({ mergeParams: true });
const { protect, restrict } = require('../middleware/auth.middleware');
const {
  getRegistrations,
  getRegistrationById,
  createRegistration,
  updateRegistration,
  deleteRegistration,
  checkInRegistration,
  importRegistrations,
  getRegistrationsCount,
  exportRegistrationsController
} = require('../controllers/registration.controller');
const registrationController = require('../controllers/registration.controller');

// Routes for registrations specific to an event (mounted under /events/:eventId/registrations)
router.route('/')
  .get(protect, getRegistrations)
  .post(protect, createRegistration);

// Route for exporting event-specific registrations
router.route('/export')
  .get(protect, exportRegistrationsController);

// Bulk import for event-specific registrations
router.route('/import')
  .post(protect, importRegistrations);

// Route for getting count of event-specific registrations
router.route('/count')
    .get(protect, getRegistrationsCount);

// Routes for specific registration within an event
router.route('/:registrationId') // Use :registrationId to be clear
  .get(protect, getRegistrationById)
  .put(protect, updateRegistration)
  .delete(protect, deleteRegistration);

// Check-in route for specific registration
router.route('/:registrationId/check-in') // Use :registrationId
  .post(protect, checkInRegistration);

// Event-specific registrations - Covered by GET '/' above
// router.route('/event/:eventId')
//   .get(protect, getRegistrations);

// Get registration count for an event - Covered by GET '/count' above
// router.route('/event/:eventId/count')
//   .get(protect, getRegistrationsCount);

// Bulk import - Should likely be under eventId context, now at /import
// router.route('/import')
//   .post(protect, importRegistrations);

router.post('/:registrationId/send-payment-link', protect, restrict('admin','staff'), registrationController.sendPaymentLink);

// Resource blocking routes
const resourceBlockingRoutes = require('./resourceBlocking.routes');
router.use('/:registrationId/resource-blocks', resourceBlockingRoutes);

// Get resource usage for a specific registration
router.get('/:registrationId/resource-usage', protect, restrict('admin','staff','organizer'), registrationController.getRegistrationResourceUsage);

module.exports = router; 