const cron = require('node-cron');
const logger = require('../config/logger');
const EventDeletionScheduler = require('../models/EventDeletionScheduler');
const EventDeletionService = require('./EventDeletionService');
const AuditLogService = require('./AuditLogService');

/**
 * EventDeletionJobService
 * Background service that processes scheduled event deletions
 * Runs every minute to check for expired grace periods
 */
class EventDeletionJobService {
  constructor() {
    this.isRunning = false;
    this.jobInterval = null;
    this.processingQueue = new Set();
    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      lastRun: null,
      errors: []
    };
  }

  /**
   * Start the background job service
   */
  start() {
    if (this.isRunning) {
      logger.warn('⚠️  EventDeletionJobService is already running');
      return;
    }

    logger.info('🚀 Starting EventDeletionJobService...');
    
    // Run every minute to check for expired grace periods
    this.jobInterval = cron.schedule('*/1 * * * *', async () => {
      await this.processScheduledDeletions();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    // Also run notification service every 5 minutes
    this.notificationInterval = cron.schedule('*/5 * * * *', async () => {
      await this.sendNotifications();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    // Cleanup old records daily at 2 AM
    this.cleanupInterval = cron.schedule('0 2 * * *', async () => {
      await this.cleanupOldRecords();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.isRunning = true;
    logger.info('✅ EventDeletionJobService started successfully');
    logger.info('📅 Deletion check: Every 1 minute');
    logger.info('📧 Notifications: Every 5 minutes');
    logger.info('🧹 Cleanup: Daily at 2 AM UTC');
  }

  /**
   * Stop the background job service
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('⚠️  EventDeletionJobService is not running');
      return;
    }

    logger.info('🛑 Stopping EventDeletionJobService...');
    
    if (this.jobInterval) {
      this.jobInterval.destroy();
      this.jobInterval = null;
    }

    if (this.notificationInterval) {
      this.notificationInterval.destroy();
      this.notificationInterval = null;
    }

    if (this.cleanupInterval) {
      this.cleanupInterval.destroy();
      this.cleanupInterval = null;
    }

    this.isRunning = false;
    logger.info('✅ EventDeletionJobService stopped');
  }

  /**
   * Process all scheduled deletions that have reached their execution time
   */
  async processScheduledDeletions() {
    try {
      this.stats.lastRun = new Date();
      
      // Find pending deletions ready for execution
      const pendingDeletions = await EventDeletionScheduler.findPendingDeletions();
      
      if (pendingDeletions.length === 0) {
        logger.debug('🔍 No pending deletions found');
        return;
      }

      logger.info(`🔥 Found ${pendingDeletions.length} pending deletion(s) ready for execution`);

      // Process each deletion
      for (const scheduledDeletion of pendingDeletions) {
        await this.processIndividualDeletion(scheduledDeletion);
      }

    } catch (error) {
      logger.error('❌ Error in processScheduledDeletions:', error);
      this.stats.errors.push({
        error: error.message,
        timestamp: new Date(),
        context: 'processScheduledDeletions'
      });
    }
  }

  /**
   * Process a single scheduled deletion
   */
  async processIndividualDeletion(scheduledDeletion) {
    const eventId = scheduledDeletion.event._id || scheduledDeletion.event;
    const eventName = scheduledDeletion.eventMetadata?.name || 'Unknown Event';
    
    // Prevent duplicate processing
    if (this.processingQueue.has(eventId.toString())) {
      logger.warn(`⚠️  Deletion for ${eventName} (${eventId}) is already being processed`);
      return;
    }

    this.processingQueue.add(eventId.toString());
    
    try {
      logger.info(`🔥 EXECUTING DELETION: ${eventName} (${eventId})`);
      
      // Update status to executing
      scheduledDeletion.status = 'executing';
      scheduledDeletion.executionStartedAt = new Date();
      await scheduledDeletion.save();

      // Audit log deletion started
      await AuditLogService.logDeletionStarted(scheduledDeletion);

      // Perform the cascade deletion
      const deletionService = new EventDeletionService();
      const deletionStats = await deletionService.cascadeDeleteEvent(eventId, {
        dryRun: false,
        skipBackup: false
      });

      // Update with completion status
      scheduledDeletion.status = 'completed';
      scheduledDeletion.executionCompletedAt = new Date();
      scheduledDeletion.deletionStats = {
        totalCollections: deletionStats.totalCollections,
        totalRecords: deletionStats.totalRecords,
        collectionsDeleted: deletionStats.collectionsDeleted,
        recordCounts: Object.fromEntries(deletionStats.recordCounts),
        startTime: deletionStats.startTime,
        endTime: deletionStats.endTime,
        duration: deletionStats.duration
      };
      
      await scheduledDeletion.save();

      // Audit log deletion completed
      await AuditLogService.logDeletionCompleted(scheduledDeletion, deletionStats);

      this.stats.totalProcessed++;
      this.stats.successful++;

      logger.info(`✅ DELETION COMPLETED: ${eventName} (${eventId})`);
      logger.info(`📊 Deleted ${deletionStats.totalRecords} records from ${deletionStats.totalCollections} collections in ${deletionStats.duration}ms`);

      // Send completion notification (if email service available)
      await this.sendCompletionNotification(scheduledDeletion);

    } catch (error) {
      logger.error(`❌ DELETION FAILED: ${eventName} (${eventId}):`, error);

      // Update with failure status
      scheduledDeletion.status = 'failed';
      scheduledDeletion.executionFailedAt = new Date();
      scheduledDeletion.executionError = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date()
      };
      
      await scheduledDeletion.save();

      // Audit log deletion failure
      await AuditLogService.logDeletionFailed(scheduledDeletion, error);

      this.stats.totalProcessed++;
      this.stats.failed++;
      this.stats.errors.push({
        eventId,
        eventName,
        error: error.message,
        timestamp: new Date(),
        context: 'deletion'
      });

      // Send failure notification
      await this.sendFailureNotification(scheduledDeletion, error);

    } finally {
      this.processingQueue.delete(eventId.toString());
    }
  }

  /**
   * Send notifications for upcoming deletions
   */
  async sendNotifications() {
    try {
      // Find deletions within 30 minutes that haven't been notified
      const upcomingDeletions = await EventDeletionScheduler.findUpcomingDeletions(30);
      
      for (const scheduledDeletion of upcomingDeletions) {
        const remainingMinutes = Math.floor(scheduledDeletion.getRemainingTime() / (1000 * 60));
        
        // Send 30-minute warning
        if (remainingMinutes <= 30 && remainingMinutes > 25 && !scheduledDeletion.notificationsSent.reminder30min) {
          await this.send30MinuteWarning(scheduledDeletion);
          scheduledDeletion.notificationsSent.reminder30min = true;
          await scheduledDeletion.save();
        }
        
        // Send 5-minute warning
        if (remainingMinutes <= 5 && remainingMinutes > 0 && !scheduledDeletion.notificationsSent.reminder5min) {
          await this.send5MinuteWarning(scheduledDeletion);
          scheduledDeletion.notificationsSent.reminder5min = true;
          await scheduledDeletion.save();
        }
      }
      
    } catch (error) {
      logger.error('❌ Error sending notifications:', error);
    }
  }

  /**
   * Clean up old deletion records
   */
  async cleanupOldRecords() {
    try {
      logger.info('🧹 Starting cleanup of old deletion records...');
      
      const result = await EventDeletionScheduler.cleanupOldRecords(30); // 30 days
      
      if (result.deletedCount > 0) {
        logger.info(`✅ Cleaned up ${result.deletedCount} old deletion records`);
      } else {
        logger.debug('ℹ️  No old deletion records to clean up');
      }
      
    } catch (error) {
      logger.error('❌ Error during cleanup:', error);
    }
  }

  /**
   * Send 30-minute warning notification
   */
  async send30MinuteWarning(scheduledDeletion) {
    try {
      logger.warn(`⚠️  30-MINUTE WARNING: ${scheduledDeletion.eventMetadata.name} will be permanently deleted in 30 minutes`);
      
      // Here you would integrate with your email service
      // Example: await emailService.sendDeletionWarning(scheduledDeletion, '30 minutes');
      
    } catch (error) {
      logger.error('❌ Error sending 30-minute warning:', error);
    }
  }

  /**
   * Send 5-minute warning notification
   */
  async send5MinuteWarning(scheduledDeletion) {
    try {
      logger.error(`🚨 FINAL WARNING: ${scheduledDeletion.eventMetadata.name} will be permanently deleted in 5 minutes!`);
      
      // Here you would integrate with your email service
      // Example: await emailService.sendFinalWarning(scheduledDeletion, '5 minutes');
      
    } catch (error) {
      logger.error('❌ Error sending 5-minute warning:', error);
    }
  }

  /**
   * Send completion notification
   */
  async sendCompletionNotification(scheduledDeletion) {
    try {
      logger.info(`📧 Sending completion notification for ${scheduledDeletion.eventMetadata.name}`);
      
      // Here you would integrate with your email service
      // Example: await emailService.sendDeletionComplete(scheduledDeletion);
      
    } catch (error) {
      logger.error('❌ Error sending completion notification:', error);
    }
  }

  /**
   * Send failure notification
   */
  async sendFailureNotification(scheduledDeletion, error) {
    try {
      logger.error(`📧 Sending failure notification for ${scheduledDeletion.eventMetadata.name}`);
      
      // Here you would integrate with your email service
      // Example: await emailService.sendDeletionFailed(scheduledDeletion, error);
      
    } catch (error) {
      logger.error('❌ Error sending failure notification:', error);
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      queueSize: this.processingQueue.size,
      ...this.stats,
      uptime: this.isRunning ? Date.now() - (this.stats.lastRun || Date.now()) : 0
    };
  }

  /**
   * Get status of all scheduled deletions
   */
  async getAllScheduledDeletions() {
    try {
      const deletions = await EventDeletionScheduler.find({
        isDeleted: false
      })
      .populate('initiatedBy cancelledBy', 'name email role')
      .sort({ scheduledAt: -1 })
      .limit(100);

      return deletions.map(deletion => ({
        id: deletion._id,
        eventName: deletion.eventMetadata.name,
        status: deletion.status,
        scheduledAt: deletion.scheduledAt,
        executeAt: deletion.executeAt,
        remainingTime: deletion.getRemainingTime(),
        remainingTimeFormatted: deletion.getRemainingTimeFormatted(),
        canCancel: deletion.canBeCancelled(),
        initiatedBy: deletion.initiatedBy,
        registrationCount: deletion.eventMetadata.registrationCount
      }));
      
    } catch (error) {
      logger.error('❌ Error getting scheduled deletions:', error);
      throw error;
    }
  }

  /**
   * Force process a specific deletion (admin override)
   */
  async forceProcessDeletion(schedulerId) {
    try {
      const scheduledDeletion = await EventDeletionScheduler.findById(schedulerId)
        .populate('event');
      
      if (!scheduledDeletion) {
        throw new Error('Scheduled deletion not found');
      }
      
      if (scheduledDeletion.status !== 'scheduled') {
        throw new Error(`Cannot force process deletion with status: ${scheduledDeletion.status}`);
      }
      
      logger.warn(`🚨 FORCE PROCESSING deletion: ${scheduledDeletion.eventMetadata.name}`);
      
      await this.processIndividualDeletion(scheduledDeletion);
      
      return scheduledDeletion;
      
    } catch (error) {
      logger.error('❌ Error force processing deletion:', error);
      throw error;
    }
  }
}

// Create singleton instance
const eventDeletionJobService = new EventDeletionJobService();

module.exports = eventDeletionJobService; 