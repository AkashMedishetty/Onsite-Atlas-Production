const express = require('express');
const router = express.Router();
const { protect, restrict } = require('../middleware/auth.middleware');
const { checkEventNotArchived } = require('../middleware/archive.middleware');
const {
  getEvents,
  createEvent,
  getEventById,
  updateEvent,
  deleteEvent,
  archiveEvent,
  getEventDashboard,
  getEventStatistics,
  getEventResourceConfig,
  getAbstractSettings,
  updateAbstractSettings,
  getBadgeSettings,
  updateBadgeSettings,
  getEmailSettings,
  updateEmailSettings,
  getPortalSettings,
  updatePortalSettings,
  getComponentConfig,
  updateComponentConfig,
  toggleComponentRegistration,
  updateDailyConfiguration,
  updateWorkshopComponents,
  updateSessionComponents,
  updatePackageDeals,
  getComponentAnalytics
} = require('../controllers/event.controller');
const { getEventResourceStatistics, exportResourceUsage } = require('../controllers/resource.controller');
const { getCategories, getCategoriesPublic, createCategory } = require('../controllers/category.controller');
const { validate, schemas } = require('../middleware/validator');
const { createRegistration, createRegistrationPublic } = require('../controllers/registration.controller');
const { getAuthors, exportAuthors } = require('../controllers/abstractAuthor.controller');

// --- Import Registration Router --- 
const registrationRouter = require('./registrations.routes');
// --- Import Resource Router ---
const resourceRouter = require('./resource.routes');
// --- Import Announcement Router ---
const announcementRouter = require('./announcementRoutes');
// --- Import Sponsor Router ---
const sponsorRouter = require('./sponsor.routes');

// --- Import Category Router (if not already done elsewhere) ---
// Assuming category routes are handled here or imported as needed
// const categoryRouter = require('./category.routes'); 

// Get all events and create new event
router.route('/')
  .get(getEvents)
  .post(protect, createEvent);

// Event by ID routes
router.route('/:id')
  .get(getEventById)
  .put(protect, updateEvent)
  .delete(protect, restrict('admin'), deleteEvent);

// Archive event route
router.route('/:id/archive')
  .patch(protect, archiveEvent);

// Event dashboard
router.route('/:id/dashboard')
  .get(protect, getEventDashboard);

// Event statistics
router.route('/:id/stats')
  .get(protect, getEventStatistics);

// Event Resource Configuration
router.route('/:id/resource-config')
  .get(protect, getEventResourceConfig);

// --- Mount Nested Routers --- 

// Handle category routes specific to an event
router.route('/:id/categories')
  // Get categories for a specific event
  .get(protect, getCategories) 
  // Create a new category for a specific event
  .post(protect, createCategory);
  
// Mount the registration router for paths starting with /:id/registrations
// This handles GET /, POST /, GET /:regId, PUT /:regId, DELETE /:regId relative to the mount point
router.use('/:id/registrations', registrationRouter); 

// Mount the resource router for paths starting with /:id/resources
router.use('/:id/resources', resourceRouter);

// Mount the abstract router
router.use('/:eventId/abstracts', require('./abstracts.routes'));

// Mount the landing page router
router.use('/:eventId/landing-pages', require('./landingPages.routes'));

// Mount the announcement router for paths starting with /:id/announcements
// Note: Ensure :id parameter name consistency with other event-specific routes.
router.use('/:id/announcements', announcementRouter);

// Mount the sponsor router for paths starting with /:id/sponsors (or /:eventId/sponsors)
// Using :id to be consistent with other routes in this file like registrations, resources.
router.use('/:id/sponsors', sponsorRouter);

// --- End Mount Nested Routers --- 

// Abstract settings route
router.route('/:id/abstract-settings')
  .get(getAbstractSettings)
  .put(updateAbstractSettings);

// Resource statistics endpoint for the event
router.get('/:id/resources/statistics', protect, getEventResourceStatistics);

// --- ADD Resource Export Route --- 
router.get('/:id/resources/export', protect, exportResourceUsage);

// Badge routes
router.route('/:id/badge-settings')
  .get(getBadgeSettings)
  .put(updateBadgeSettings);

// Email Settings routes
router.route('/:id/email-settings')
  .get(getEmailSettings)
  .put(updateEmailSettings);

// Event Portal Settings Routes
router.route('/:id/portal-settings')
  .get(getPortalSettings)
  .put(updatePortalSettings);

// =====================================================
// NEW: Component-Based Registration Management Routes
// =====================================================

// Component configuration routes
router.route('/:id/component-config')
  .get(protect, getComponentConfig)
  .put(protect, restrict('admin', 'staff'), updateComponentConfig);

// Toggle component-based registration
router.route('/:id/component-config/toggle')
  .patch(protect, restrict('admin', 'staff'), toggleComponentRegistration);

// Daily configuration management
router.route('/:id/component-config/daily')
  .put(protect, restrict('admin', 'staff'), updateDailyConfiguration);

// Workshop components management
router.route('/:id/component-config/workshops')
  .put(protect, restrict('admin', 'staff'), updateWorkshopComponents);

// Session components management
router.route('/:id/component-config/sessions')
  .put(protect, restrict('admin', 'staff'), updateSessionComponents);

// Package deals management
router.route('/:id/component-config/packages')
  .put(protect, restrict('admin', 'staff'), updatePackageDeals);

// Component analytics
router.route('/:id/component-analytics')
  .get(protect, restrict('admin', 'staff'), getComponentAnalytics);

// Add public categories route (protected from archived events)
router.route('/:id/public-categories')
  .get(checkEventNotArchived, getCategoriesPublic);

// Add public registration route (protected from archived events)
router.route('/:eventId/public-registrations')
  .post(checkEventNotArchived, createRegistrationPublic);

const emailRouter = require('./email.routes');
// Mount the email router for event-specific email routes
router.use('/:eventId/emails', emailRouter);

// Route to get abstract-only authors for an event
router.get('/:eventId/abstract-authors', protect, restrict('admin','staff'), getAuthors);

// Export authors CSV
router.get('/:eventId/abstract-authors/export', protect, restrict('admin','staff'), exportAuthors);

module.exports = router;