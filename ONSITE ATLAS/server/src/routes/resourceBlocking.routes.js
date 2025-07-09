const express = require('express');
const { protect, restrict } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validator');
const { body, param } = require('express-validator');
const {
  getRegistrationResourceBlocks,
  blockResourceForRegistration,
  removeResourceBlock,
  checkResourceBlock
} = require('../controllers/resourceBlocking.controller');

const router = express.Router({ mergeParams: true });

// Validation schemas
const blockResourceValidation = [
  body('resourceId')
    .notEmpty()
    .isMongoId()
    .withMessage('Valid resource ID is required'),
  body('resourceType')
    .notEmpty()
    .isIn(['food', 'kit', 'certificate', 'certificate_printing', 'custom'])
    .withMessage('Valid resource type is required'),
  body('reason')
    .notEmpty()
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
  body('blockType')
    .optional()
    .isIn(['temporary', 'permanent', 'conditional'])
    .withMessage('Invalid block type'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Valid expiration date is required')
];

const removeBlockValidation = [
  body('reason')
    .notEmpty()
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason for removal must be between 5 and 500 characters')
];

const mongoIdValidation = [
  param('eventId').isMongoId().withMessage('Valid event ID is required'),
  param('registrationId').isMongoId().withMessage('Valid registration ID is required'),
  param('resourceId').isMongoId().withMessage('Valid resource ID is required')
];

// Apply authentication to all routes
router.use(protect);

// Registration-specific resource blocking routes
router.route('/')
  .get(restrict('admin', 'staff'), getRegistrationResourceBlocks)
  .post(restrict('admin', 'staff'), validate(blockResourceValidation), blockResourceForRegistration);

router.route('/:resourceId')
  .delete(restrict('admin', 'staff'), validate(removeBlockValidation), removeResourceBlock);

// Check resource block status (can be accessed by registration owner)
router.get('/:resourceId/check',
  validate(mongoIdValidation),
  checkResourceBlock
);

module.exports = router;
