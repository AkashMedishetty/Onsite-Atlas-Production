const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultiple,
  getStats,
  createTestNotification,
  getByType,
  updatePreferences,
  exportNotifications
} = require('../controllers/adminNotificationController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/expressValidation');
const { body, param, query } = require('express-validator');

// Authentication middleware - all routes require authentication
router.use(authenticate);

// Validation schemas
const markAsReadValidation = [
  param('id').isMongoId().withMessage('Invalid notification ID')
];

const deleteMultipleValidation = [
  body('ids')
    .isArray({ min: 1 })
    .withMessage('IDs must be a non-empty array')
    .custom((value) => {
      if (!value.every(id => /^[0-9a-fA-F]{24}$/.test(id))) {
        throw new Error('All IDs must be valid MongoDB ObjectIds');
      }
      return true;
    })
];

const createTestNotificationValidation = [
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('message')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),
  body('type')
    .optional()
    .isIn(['registration', 'payment', 'abstract', 'alert', 'success', 'info', 'system', 'event'])
    .withMessage('Invalid notification type'),
  body('priority')
    .optional()
    .isIn(['critical', 'high', 'normal', 'low'])
    .withMessage('Invalid priority level')
];

const getNotificationsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('type')
    .optional()
    .isIn(['registration', 'payment', 'abstract', 'alert', 'success', 'info', 'system', 'event'])
    .withMessage('Invalid notification type'),
  query('read')
    .optional()
    .isBoolean()
    .withMessage('Read must be a boolean'),
  query('priority')
    .optional()
    .isIn(['critical', 'high', 'normal', 'low'])
    .withMessage('Invalid priority level'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters')
];

const getByTypeValidation = [
  param('type')
    .isIn(['registration', 'payment', 'abstract', 'alert', 'success', 'info', 'system', 'event'])
    .withMessage('Invalid notification type'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const exportValidation = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be either json or csv'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('type')
    .optional()
    .isIn(['registration', 'payment', 'abstract', 'alert', 'success', 'info', 'system', 'event'])
    .withMessage('Invalid notification type')
];

// Routes

/**
 * @route   GET /api/admin-notifications
 * @desc    Get all notifications for the authenticated user with pagination and filtering
 * @access  Private
 * @query   page, limit, type, read, priority, startDate, endDate, search
 */
router.get('/', getNotificationsValidation, validate, getNotifications);

/**
 * @route   GET /api/admin-notifications/unread-count
 * @desc    Get unread notification count for the authenticated user
 * @access  Private
 */
router.get('/unread-count', getUnreadCount);

/**
 * @route   GET /api/admin-notifications/stats
 * @desc    Get notification statistics for the authenticated user
 * @access  Private
 * @query   timeframe (default: 7d)
 */
router.get('/stats', getStats);

/**
 * @route   GET /api/admin-notifications/export
 * @desc    Export notifications in JSON or CSV format
 * @access  Private
 * @query   format, startDate, endDate, type
 */
router.get('/export', exportValidation, validate, exportNotifications);

/**
 * @route   GET /api/admin-notifications/type/:type
 * @desc    Get notifications by type with pagination
 * @access  Private
 * @params  type
 * @query   page, limit
 */
router.get('/type/:type', getByTypeValidation, validate, getByType);

/**
 * @route   POST /api/admin-notifications/test
 * @desc    Create a test notification (development/testing only)
 * @access  Private (Development/Super Admin only)
 * @body    title, message, type, priority
 */
router.post('/test', createTestNotificationValidation, validate, createTestNotification);

/**
 * @route   PUT /api/admin-notifications/:id/read
 * @desc    Mark a specific notification as read
 * @access  Private
 * @params  id (notification ID)
 */
router.put('/:id/read', markAsReadValidation, validate, markAsRead);

/**
 * @route   PUT /api/admin-notifications/mark-all-read
 * @desc    Mark all notifications as read for the authenticated user
 * @access  Private
 */
router.put('/mark-all-read', markAllAsRead);

/**
 * @route   PUT /api/admin-notifications/preferences
 * @desc    Update notification preferences (future feature)
 * @access  Private
 * @body    preferences object
 */
router.put('/preferences', updatePreferences);

/**
 * @route   DELETE /api/admin-notifications/:id
 * @desc    Delete a specific notification
 * @access  Private
 * @params  id (notification ID)
 */
router.delete('/:id', markAsReadValidation, validate, deleteNotification);

/**
 * @route   DELETE /api/admin-notifications/bulk
 * @desc    Delete multiple notifications
 * @access  Private
 * @body    ids (array of notification IDs)
 */
router.delete('/bulk', deleteMultipleValidation, validate, deleteMultiple);

module.exports = router; 