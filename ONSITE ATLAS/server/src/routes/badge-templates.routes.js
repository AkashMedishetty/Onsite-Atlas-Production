const express = require('express');
const {
  getBadgeTemplates,
  getBadgeTemplateById,
  createBadgeTemplate,
  updateBadgeTemplate,
  deleteBadgeTemplate,
  duplicateBadgeTemplate,
  setDefaultTemplate
} = require('../controllers/badgeTemplate.controller');

const { protect } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');
const StandardErrorHandler = require('../utils/standardErrorHandler');

const router = express.Router();

// Add a test route that doesn't require authentication
router.get('/test', (req, res) => {
  logger.info('Badge template test route hit');
  return res.status(200).json({
    success: true,
    message: 'Badge template routes are working!'
  });
});

// Protect all other routes
router.use(protect);

// Debugging middleware to log all requests to badge template routes
router.use((req, res, next) => {
  logger.info(`[BADGE-TEMPLATE] ${req.method} request to ${req.originalUrl}`);
  logger.info('[BADGE-TEMPLATE] Request body:', req.body);
  logger.info('[BADGE-TEMPLATE] User:', req.user ? req.user.id : 'Not authenticated');
  next();
});

// Routes
router.route('/')
  .get(getBadgeTemplates)
  .post(createBadgeTemplate);

router.route('/:id')
  .get(getBadgeTemplateById)
  .put(updateBadgeTemplate)
  .delete(deleteBadgeTemplate);

router.route('/:id/duplicate')
  .post(duplicateBadgeTemplate);

// Add route for setting default badge template
router.post('/:eventId/:templateId/set-default', setDefaultTemplate);

logger.info('Badge template routes have been defined in the router');

module.exports = router; 