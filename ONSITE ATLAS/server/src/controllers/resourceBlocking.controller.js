const ResourceBlocking = require('../models/ResourceBlocking');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const { sendSuccess } = require('../utils/responseFormatter');
const { createApiError } = require('../middleware/error');
const asyncHandler = require('../middleware/async');

/**
 * Get all resource blocks for a specific registration
 * @route   GET /api/events/:eventId/registrations/:registrationId/resource-blocks
 * @access  Private (Admin, Staff)
 */
const getRegistrationResourceBlocks = asyncHandler(async (req, res, next) => {
  const { eventId, registrationId } = req.params;

  // Validate that the registration exists
  const registration = await Registration.findById(registrationId);
  if (!registration) {
    return next(createApiError(404, 'Registration not found'));
  }

  // Get all resource blocks for this registration
  const resourceBlocks = await ResourceBlocking.find({
    event: eventId,
    registration: registrationId,
    isActive: true
  })
  .populate('blockedBy', 'name email')
  .populate('removedBy', 'name email')
  .sort({ createdAt: -1 });

  sendSuccess(res, 200, 'Resource blocks retrieved successfully', resourceBlocks);
});

/**
 * Block a resource for a specific registration
 * @route   POST /api/events/:eventId/registrations/:registrationId/resource-blocks
 * @access  Private (Admin, Staff)
 */
const blockResourceForRegistration = asyncHandler(async (req, res, next) => {
  const { eventId, registrationId } = req.params;
  const { resourceId, resourceType, reason, blockType = 'temporary', expiresAt } = req.body;

  // Validate that the registration exists
  const registration = await Registration.findById(registrationId);
  if (!registration) {
    return next(createApiError(404, 'Registration not found'));
  }

  // Check if resource is already blocked
  const existingBlock = await ResourceBlocking.findOne({
    event: eventId,
    registration: registrationId,
    resourceId,
    resourceType,
    isActive: true
  });

  if (existingBlock) {
    return next(createApiError(400, 'Resource is already blocked for this registration'));
  }

  // Create new resource block
  const resourceBlock = await ResourceBlocking.create({
    event: eventId,
    registration: registrationId,
    resourceId,
    resourceType,
    reason,
    blockType,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    blockedBy: req.user._id,
    isActive: true
  });

  await resourceBlock.populate('blockedBy', 'name email');

  sendSuccess(res, 201, 'Resource blocked successfully', resourceBlock);
});

/**
 * Remove a resource block
 * @route   DELETE /api/events/:eventId/registrations/:registrationId/resource-blocks/:resourceId
 * @access  Private (Admin, Staff)
 */
const removeResourceBlock = asyncHandler(async (req, res, next) => {
  const { eventId, registrationId, resourceId } = req.params;
  const { reason } = req.body;

  // Find the resource block
  const resourceBlock = await ResourceBlocking.findOne({
    event: eventId,
    registration: registrationId,
    _id: resourceId,
    isActive: true
  });

  if (!resourceBlock) {
    return next(createApiError(404, 'Resource block not found'));
  }

  // Update the block to mark it as removed
  resourceBlock.isActive = false;
  resourceBlock.removedAt = new Date();
  resourceBlock.removedBy = req.user._id;
  resourceBlock.removalReason = reason;

  await resourceBlock.save();
  await resourceBlock.populate('removedBy', 'name email');

  sendSuccess(res, 200, 'Resource block removed successfully', resourceBlock);
});

/**
 * Check if a resource is blocked for a registration
 * @route   GET /api/events/:eventId/registrations/:registrationId/resource-blocks/:resourceId/check
 * @access  Private
 */
const checkResourceBlock = asyncHandler(async (req, res, next) => {
  const { eventId, registrationId, resourceId } = req.params;

  const resourceBlock = await ResourceBlocking.findOne({
    event: eventId,
    registration: registrationId,
    resourceId,
    isActive: true
  });

  const isBlocked = !!resourceBlock;
  const blockInfo = resourceBlock ? {
    reason: resourceBlock.reason,
    blockType: resourceBlock.blockType,
    blockedAt: resourceBlock.createdAt,
    expiresAt: resourceBlock.expiresAt,
    blockedBy: resourceBlock.blockedBy
  } : null;

  sendSuccess(res, 200, 'Resource block status checked', {
    isBlocked,
    blockInfo
  });
});

module.exports = {
  getRegistrationResourceBlocks,
  blockResourceForRegistration,
  removeResourceBlock,
  checkResourceBlock
};
