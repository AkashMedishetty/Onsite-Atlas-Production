const express = require('express');
const router = express.Router();

// Import all route modules
const eventRoutes = require('./event.routes');
const userRoutes = require('./user.routes');
const authRoutes = require('./auth.routes');
const abstractRoutes = require('./abstract.routes');
const abstractsRoutes = require('./abstracts.routes');
const registrationRoutes = require('./registration.routes');
const registrationResourceRoutes = require('./registrationResource.routes');
const dashboardRoutes = require('./dashboard.routes');
const analyticsRoutes = require('./analytics.routes');
const reportRoutes = require('./report.routes');
const categoryRoutes = require('./categories.routes');
const resourceRoutes = require('./resources.routes');
const importJobRoutes = require('./importJob.routes');
const registrantPortalRoutesFile = require('./registrantPortalRoutes'); // CORRECTED FILENAME (plural Routes)
const scheduleRoutes = require('./schedule.routes'); // IMPORT schedule.routes
const sponsorAuthRoutes = require('./sponsorAuth.routes'); // Added Sponsor Auth Routes
const registrationResourceModalRoutes = require('./registrationResourceModal.routes');
const clientPortalRoutes = require('./clientPortal.routes');
const clientBulkImportRoutes = require('./clientBulkImport.routes');
const authorAuthRoutes = require('./authorAuth.routes');
const abstractAuthorsRoutes = require('./abstractAuthors.routes');
const adminNotificationRoutes = require('./adminNotification.routes');

// Mount routes
router.use('/events', eventRoutes);
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/abstracts', abstractsRoutes);
router.use('/events/:eventId/abstracts', abstractRoutes);
router.use('/sponsor-auth', sponsorAuthRoutes); // Added Sponsor Auth Routes
router.use('/events/:eventId/registrations', registrationRoutes);
router.use('/events', registrationResourceRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/reports', reportRoutes);

// Mount resource and category routes at root level
router.use('/categories', categoryRoutes);
router.use('/resources', resourceRoutes);

// Also mount them at event level for backward compatibility or specific needs
router.use('/events/:eventId/categories', categoryRoutes);
router.use('/import-jobs', importJobRoutes);

// Mount schedule routes
router.use(scheduleRoutes); // MOUNT scheduleRoutes

// Mount registrant portal routes
router.use('/registrant-portal', registrantPortalRoutesFile); // Use the correctly required file

router.use(registrationResourceModalRoutes);

router.use('/client-portal', clientPortalRoutes);

router.use('/client-bulk-import', clientBulkImportRoutes);

router.use('/author-auth', authorAuthRoutes);

router.use(abstractAuthorsRoutes);

router.use('/events/:eventId/payments', require('./payment.routes'));
router.use('/webhooks', require('./webhook.routes'));

router.use('/events/:eventId/registrations/quote', require('./quote.routes'));

router.use('/public/events/:eventId/registrations', require('./publicRegistration.routes'));

// payments settings handled in paymentConfig.routes via /settings

router.use('/events/:eventId/pricing-rules', require('./pricingRule.routes'));
router.use('/events/:eventId/workshops', require('./workshop.routes'));

router.use('/events/:eventId/payment-config', require('./paymentConfig.routes'));

// Mount admin notification routes
router.use('/admin-notifications', adminNotificationRoutes);

module.exports = router; 