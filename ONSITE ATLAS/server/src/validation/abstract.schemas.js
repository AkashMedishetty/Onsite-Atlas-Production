const { body, param } = require('express-validator');
const mongoose = require('mongoose');

// Custom validator to check for valid MongoDB ObjectId
const isValidObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error('Invalid ObjectId');
  }
  return true;
};

/**
 * Schema for creating a new abstract (using express-validator)
 */
const createAbstract = [
  // eventId is usually from req.params in nested routes, not body
  // param('eventId').custom(isValidObjectId).withMessage('Invalid Event ID'), 
  // registration is required for registrant flow but optional for author flow.
  body('registration').custom((value, { req }) => {
    // If the request is coming from an author (detected by protectAuthor middleware), skip this validation
    if (req.author) {
      return true; // author submissions don't carry a registration ID
    }

    // For registrant flow, ensure a registration ID exists and is a valid ObjectId
    if (!value) {
      throw new Error('Registration ID is required');
    }
    // Validate ObjectId format
    if (!isValidObjectId(value)) {
      throw new Error('Invalid Registration ID');
    }
    return true;
  }),
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('authors')
    .trim()
    .notEmpty().withMessage('Authors are required'),
  body('affiliations') // Assuming affiliations corresponds to authorAffiliations
    .optional()
    .trim(),
  body('category') // Assuming category corresponds to topic/category ID
    .trim()
    .notEmpty().withMessage('Category is required')
    .custom(isValidObjectId).withMessage('Invalid Category ID format'), // Check if it should be ObjectId
  body('content')
    .trim()
    .notEmpty().withMessage('Content is required')
    .isLength({ max: 5000 }).withMessage('Content cannot exceed 5000 characters') // Match Joi schema length
];

/**
 * Schema for updating an abstract (using express-validator)
 * NOTE: Convert other schemas (update, status, comment) similarly if needed.
 */
const updateAbstract = [
  param('id') // Validate the abstract ID from the URL param
    .custom(isValidObjectId).withMessage('Invalid Abstract ID'),
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Title cannot be empty if provided')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('authors')
    .optional()
    .trim()
    .notEmpty().withMessage('Authors cannot be empty if provided'),
  body('affiliations')
    .optional()
    .trim(),
  body('category')
    .optional()
    .trim()
    .notEmpty().withMessage('Category cannot be empty if provided')
    .custom(isValidObjectId).withMessage('Invalid Category ID format'),
  body('content')
    .optional()
    .trim()
    .notEmpty().withMessage('Content cannot be empty if provided')
    .isLength({ max: 5000 }).withMessage('Content cannot exceed 5000 characters'),
  // Ensure at least one field is being updated - express-validator doesn't have a direct .min(1) for body
  // This logic might need to be in the controller or use a custom validator on the whole body.
];

/**
 * Schema for updating abstract status
 */
const updateStatus = [
  param('id')
    .custom(isValidObjectId).withMessage('Invalid Abstract ID'),
  body('status')
    .trim()
    .notEmpty().withMessage('Status is required')
    .isIn(['submitted', 'under_review', 'accepted', 'rejected', 'revision_requested', 'revised', 'withdrawn'])
    .withMessage('Invalid status value'),
  body('reviewerComments')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Reviewer comments cannot exceed 1000 characters'),
  body('reviewScore')
    .optional()
    .isInt({ min: 1, max: 10 }).withMessage('Review score must be between 1 and 10'),
  body('rejectionReason')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Rejection reason cannot exceed 500 characters')
];

/**
 * Schema for adding a comment
 */
const addComment = [
  param('id')
    .custom(isValidObjectId).withMessage('Invalid Abstract ID'),
  body('text')
    .trim()
    .notEmpty().withMessage('Comment text is required')
    .isLength({ min: 1, max: 1000 }).withMessage('Comment must be between 1 and 1000 characters'),
  body('visibility')
    .optional()
    .trim()
    .isIn(['public', 'reviewer', 'internal'])
    .withMessage('Visibility must be one of: public, reviewer, internal'),
  body('isInternal')
    .optional()
    .isBoolean().withMessage('isInternal must be a boolean'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent')
];

module.exports = {
  createAbstract,
  updateAbstract,
  updateStatus, // Exporting placeholder
  addComment    // Exporting placeholder
}; 