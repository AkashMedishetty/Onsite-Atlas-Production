const asyncHandler = require('../middleware/async');
const { sendSuccess } = require('../utils/responseHelpers');
const EventBackupRecoveryService = require('../services/EventBackupRecoveryService');
const logger = require('../config/logger');

/**
 * List all available backups
 * @route GET /api/backups
 * @access Private (Admin only)
 */
const listBackups = asyncHandler(async (req, res) => {
  try {
    const recoveryService = new EventBackupRecoveryService();
    const backups = await recoveryService.listBackups();
    
    return sendSuccess(res, 200, 'Backups retrieved successfully', {
      backups,
      total: backups.length
    });
  } catch (error) {
    logger.error('Error listing backups:', error);
    return sendSuccess(res, 500, 'Failed to list backups', null, { error: error.message });
  }
});

/**
 * Get details of a specific backup
 * @route GET /api/backups/:backupId
 * @access Private (Admin only)
 */
const getBackupDetails = asyncHandler(async (req, res) => {
  try {
    const { backupId } = req.params;
    const recoveryService = new EventBackupRecoveryService();
    const backup = await recoveryService.getBackupDetails(backupId);
    
    return sendSuccess(res, 200, 'Backup details retrieved successfully', backup);
  } catch (error) {
    logger.error(`Error getting backup details for ${req.params.backupId}:`, error);
    
    if (error.message.includes('not found')) {
      return sendSuccess(res, 404, 'Backup not found');
    }
    
    return sendSuccess(res, 500, 'Failed to get backup details', null, { error: error.message });
  }
});

/**
 * Restore data from backup
 * @route POST /api/backups/:backupId/restore
 * @access Private (Admin only)
 */
const restoreBackup = asyncHandler(async (req, res) => {
  try {
    const { backupId } = req.params;
    const {
      dryRun = false,
      specificCollections = null,
      newEventId = null,
      skipExistingRecords = true
    } = req.body;
    
    const recoveryService = new EventBackupRecoveryService();
    
    logger.info(`🔄 ${dryRun ? '[DRY RUN] ' : ''}Backup restoration initiated by ${req.user?.email} for backup: ${backupId}`);
    
    const stats = await recoveryService.restoreFromBackup(backupId, {
      dryRun,
      specificCollections,
      newEventId,
      skipExistingRecords
    });
    
    const message = dryRun 
      ? 'Dry run completed - no data was actually restored'
      : 'Backup restored successfully';
    
    return sendSuccess(res, 200, message, {
      backupId,
      restorationStats: stats,
      options: {
        dryRun,
        specificCollections,
        newEventId,
        skipExistingRecords
      }
    });
    
  } catch (error) {
    logger.error(`Error restoring backup ${req.params.backupId}:`, error);
    
    if (error.message.includes('not found')) {
      return sendSuccess(res, 404, 'Backup not found');
    }
    
    return sendSuccess(res, 500, 'Failed to restore backup', null, { error: error.message });
  }
});

/**
 * Delete a backup file
 * @route DELETE /api/backups/:backupId
 * @access Private (Admin only)
 */
const deleteBackup = asyncHandler(async (req, res) => {
  try {
    const { backupId } = req.params;
    const recoveryService = new EventBackupRecoveryService();
    
    logger.info(`🗑️  Backup deletion initiated by ${req.user?.email} for backup: ${backupId}`);
    
    await recoveryService.deleteBackup(backupId);
    
    return sendSuccess(res, 200, 'Backup deleted successfully', {
      backupId,
      deletedBy: req.user?.email,
      deletedAt: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Error deleting backup ${req.params.backupId}:`, error);
    
    if (error.message.includes('not found')) {
      return sendSuccess(res, 404, 'Backup not found');
    }
    
    return sendSuccess(res, 500, 'Failed to delete backup', null, { error: error.message });
  }
});

/**
 * Test backup system
 * @route POST /api/backups/test
 * @access Private (Admin only)
 */
const testBackupSystem = asyncHandler(async (req, res) => {
  try {
    const EventDeletionService = require('../services/EventDeletionService');
    const Event = require('../models/Event');
    
    // Find a sample event to test backup creation
    const sampleEvent = await Event.findOne().lean();
    if (!sampleEvent) {
      return sendSuccess(res, 400, 'No events available to test backup system');
    }
    
    const deletionService = new EventDeletionService();
    const backupResult = await deletionService.createDeletionBackup(sampleEvent._id, sampleEvent);
    
    return sendSuccess(res, 200, 'Backup system test completed', {
      testEvent: {
        id: sampleEvent._id,
        name: sampleEvent.name
      },
      backupResult
    });
    
  } catch (error) {
    logger.error('Error testing backup system:', error);
    return sendSuccess(res, 500, 'Backup system test failed', null, { error: error.message });
  }
});

module.exports = {
  listBackups,
  getBackupDetails,
  restoreBackup,
  deleteBackup,
  testBackupSystem
}; 