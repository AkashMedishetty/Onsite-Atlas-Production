const mongoose = require('mongoose');
const logger = require('../config/logger');

/**
 * EventDeletionService
 * Handles complete cascade deletion of all event-related data
 * Ensures NO TRACE of the event remains in the database
 */
class EventDeletionService {
  constructor() {
    this.deletionStats = {
      totalCollections: 0,
      totalRecords: 0,
      collectionsDeleted: [],
      recordCounts: new Map(),
      startTime: null,
      endTime: null,
      duration: 0,
      errors: []
    };
  }

  /**
   * Perform complete cascade deletion of an event and ALL related data
   * @param {string} eventId - Event ID to delete
   * @param {Object} options - Deletion options
   * @returns {Object} Deletion statistics
   */
  async cascadeDeleteEvent(eventId, options = {}) {
    const {
      dryRun = false,
      skipBackup = false,
      logLevel = 'info'
    } = options;

    this.deletionStats.startTime = new Date();
    
    try {
      logger.info(`🔥 Starting ${dryRun ? 'DRY RUN' : 'LIVE'} cascade deletion for event: ${eventId}`);
      
      // Validate event exists
      const Event = require('../models/Event');
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error(`Event not found: ${eventId}`);
      }

      logger.info(`📋 Deleting event: "${event.name}" (${eventId})`);

      // Create backup if requested
      if (!skipBackup && !dryRun) {
        await this.createDeletionBackup(eventId, event);
      }

      // Define all collections that reference events (in deletion order)
      const collectionsToDelete = [
        // 1. Resources and Dependencies (delete first to avoid constraints)
        { model: 'Resource', field: 'event' },
        { model: 'ResourceBlocking', field: 'event' },
        { model: 'ResourceSetting', field: 'event' },
        
        // 2. Registrations and Related Data
        { model: 'Registration', field: 'event' },
        { model: 'Payment', field: 'event' },
        { model: 'PaymentLink', field: 'event' },
        { model: 'PaymentPlan', field: 'event' },
        { model: 'SeatHold', field: 'event' },
        
        // 3. Abstracts and Reviews
        { model: 'Abstract', field: 'event' },
        { model: 'AbstractReview', field: 'event' },
        
        // 4. Event Content and Configuration
        { model: 'Category', field: 'event' },
        { model: 'CategoryPrice', field: 'event' },
        { model: 'CustomField', field: 'event' },
        { model: 'Schedule', field: 'event' },
        { model: 'Workshop', field: 'event' },
        
        // 5. Communications and Notifications
        { model: 'Announcement', field: 'event' },
        { model: 'EventAnnouncement', field: 'event' },
        { model: 'NotificationTemplate', field: 'event' },
        { model: 'NotificationWorkflow', field: 'event' },
        { model: 'NotificationLog', field: 'event' },
        { model: 'ScheduledNotification', field: 'event' },
        { model: 'AdminNotification', field: 'event' },
        
        // 6. Templates and Design
        { model: 'BadgeTemplate', field: 'event' },
        { model: 'EventTemplate', field: 'baseEvent' },
        { model: 'LandingPage', field: 'event' },
        
        // 7. Certificates and Documents
        { model: 'Certificate', field: 'event' },
        
        // 8. Sponsors and Partnerships
        { model: 'EventSponsor', field: 'event' },
        
        // 9. Reports and Analytics
        { model: 'EventReport', field: 'event' },
        { model: 'Report', field: 'event' },
        { model: 'ReconciliationReport', field: 'event' },
        { model: 'AnalyticsDataCache', field: 'event' },
        { model: 'Dashboard', field: 'event' },
        
        // 10. System Data
        { model: 'ImportJob', field: 'event' },
        { model: 'AuditLog', field: 'event' },
        
        // 11. Client and Author Access
        { model: 'EventClient', field: 'event' },
        { model: 'AuthorUser', field: 'event' },
        
        // 12. Pricing and Business Logic
        { model: 'PricingTier', field: 'event' },
        
        // 13. Event Resources (specific)
        { model: 'EventResource', field: 'event' }
      ];

      // Delete from each collection
      for (const collection of collectionsToDelete) {
        await this.deleteFromCollection(collection.model, collection.field, eventId, dryRun);
      }

      // Handle special cases - User model references (clear but don't delete users)
      await this.clearUserEventReferences(eventId, dryRun);

      // Finally delete the main Event document
      await this.deleteMainEvent(eventId, dryRun);

      this.deletionStats.endTime = new Date();
      this.deletionStats.duration = this.deletionStats.endTime - this.deletionStats.startTime;

      logger.info(`✅ ${dryRun ? 'DRY RUN' : 'CASCADE DELETION'} completed successfully`);
      logger.info(`📊 Total collections processed: ${this.deletionStats.totalCollections}`);
      logger.info(`📊 Total records deleted: ${this.deletionStats.totalRecords}`);
      logger.info(`⏱️ Duration: ${this.deletionStats.duration}ms`);

      return this.deletionStats;

    } catch (error) {
      this.deletionStats.endTime = new Date();
      this.deletionStats.duration = this.deletionStats.endTime - this.deletionStats.startTime;
      this.deletionStats.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date()
      });

      logger.error(`❌ Cascade deletion failed for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Delete records from a specific collection
   */
  async deleteFromCollection(modelName, fieldName, eventId, dryRun = false) {
    try {
      const Model = require(`../models/${modelName}`);
      
      // Count records to be deleted
      const query = { [fieldName]: eventId };
      const count = await Model.countDocuments(query);
      
      if (count > 0) {
        logger.info(`🗑️  ${dryRun ? '[DRY RUN] Would delete' : 'Deleting'} ${count} records from ${modelName}`);
        
        if (!dryRun) {
          const result = await Model.deleteMany(query);
          logger.info(`✅ Deleted ${result.deletedCount} records from ${modelName}`);
        }
        
        this.deletionStats.totalRecords += count;
        this.deletionStats.recordCounts.set(modelName, count);
        this.deletionStats.collectionsDeleted.push(modelName);
      } else {
        logger.debug(`ℹ️  No records found in ${modelName} for event ${eventId}`);
      }
      
      this.deletionStats.totalCollections++;
      
    } catch (error) {
      // Some models might not exist - log warning but continue
      if (error.code === 'MODULE_NOT_FOUND') {
        logger.warn(`⚠️  Model ${modelName} not found - skipping`);
      } else {
        logger.error(`❌ Error deleting from ${modelName}:`, error);
        this.deletionStats.errors.push({
          collection: modelName,
          error: error.message,
          timestamp: new Date()
        });
        // Continue with other collections
      }
    }
  }

  /**
   * Clear event references from User model without deleting users
   */
  async clearUserEventReferences(eventId, dryRun = false) {
    try {
      const User = require('../models/User');
      
      // Clear activeEvent and lastEventAccessed references
      const usersWithActiveEvent = await User.countDocuments({ activeEvent: eventId });
      const usersWithLastAccess = await User.countDocuments({ lastEventAccessed: eventId });
      
      if (usersWithActiveEvent > 0 || usersWithLastAccess > 0) {
        logger.info(`🗑️  ${dryRun ? '[DRY RUN] Would clear' : 'Clearing'} event references from ${usersWithActiveEvent + usersWithLastAccess} user records`);
        
        if (!dryRun) {
          await User.updateMany(
            { $or: [{ activeEvent: eventId }, { lastEventAccessed: eventId }] },
            { 
              $unset: { 
                activeEvent: 1, 
                lastEventAccessed: 1 
              } 
            }
          );
        }
        
        this.deletionStats.recordCounts.set('User (references cleared)', usersWithActiveEvent + usersWithLastAccess);
      }
      
    } catch (error) {
      logger.error(`❌ Error clearing user event references:`, error);
      this.deletionStats.errors.push({
        collection: 'User',
        error: error.message,
        timestamp: new Date()
      });
    }
  }

  /**
   * Delete the main Event document
   */
  async deleteMainEvent(eventId, dryRun = false) {
    try {
      const Event = require('../models/Event');
      
      logger.info(`🗑️  ${dryRun ? '[DRY RUN] Would delete' : 'Deleting'} main Event document: ${eventId}`);
      
      if (!dryRun) {
        const result = await Event.findByIdAndDelete(eventId);
        if (result) {
          logger.info(`✅ Successfully deleted main Event document: ${result.name}`);
          this.deletionStats.recordCounts.set('Event', 1);
          this.deletionStats.collectionsDeleted.push('Event');
        } else {
          logger.warn(`⚠️  Event document not found during deletion: ${eventId}`);
        }
      }
      
      this.deletionStats.totalRecords += 1;
      this.deletionStats.totalCollections += 1;
      
    } catch (error) {
      logger.error(`❌ Error deleting main Event document:`, error);
      throw error;
    }
  }

  /**
   * Create backup of event data before deletion
   */
  async createDeletionBackup(eventId, event) {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const backupId = `event_${eventId}_backup_${Date.now()}`;
      const backupDir = path.join('./backups/event_deletions');
      const backupPath = path.join(backupDir, `${backupId}.json`);
      
      // Create backup directory if it doesn't exist
      if (!fs.existsSync('./backups')) {
        fs.mkdirSync('./backups', { recursive: true });
      }
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      logger.info(`💾 Creating backup at: ${backupPath}`);
      
      // Collect all event data
      const backupData = {
        metadata: {
          eventId,
          eventName: event.name,
          backupId,
          backupDate: new Date().toISOString(),
          version: '1.0'
        },
        eventDocument: event,
        collections: {}
      };
      
      // Define collections to backup (same as deletion order)
      const collectionsToBackup = [
        'Registration', 'Resource', 'ResourceSetting', 'Category', 'PaymentRecord', 
        'Payment', 'Abstract', 'AbstractReview', 'EventSponsor', 'SponsorshipTier',
        'EmailTemplate', 'Certificate', 'BadgeTemplate', 'Workshop', 'Schedule',
        'Announcement', 'EventUser', 'EventRole', 'LandingPage', 'CustomField',
        'Survey', 'SurveyResponse', 'EventResource', 'EventCategory', 'EventWorkshop',
        'EventSchedule', 'EventAnnouncement', 'EventBadge', 'EventCertificate',
        'EventEmail', 'EventPayment', 'AuditLog', 'AdminNotification', 'Dashboard',
        'ResourceBlocking', 'AnalyticsDataCache', 'UserEventRole'
      ];
      
      // Backup each collection
      for (const modelName of collectionsToBackup) {
        try {
          const Model = require(`../models/${modelName}`);
          const records = await Model.find({ event: eventId }).lean();
          
          if (records.length > 0) {
            backupData.collections[modelName] = records;
            logger.debug(`💾 Backed up ${records.length} records from ${modelName}`);
          }
        } catch (error) {
          // Model might not exist - continue with others
          if (error.code !== 'MODULE_NOT_FOUND') {
            logger.warn(`⚠️  Failed to backup ${modelName}: ${error.message}`);
          }
        }
      }
      
      // Also backup User references (without full user data)
      try {
        const User = require('../models/User');
        const usersWithEventRefs = await User.find({
          $or: [{ activeEvent: eventId }, { lastEventAccessed: eventId }]
        }, { _id: 1, email: 1, name: 1, activeEvent: 1, lastEventAccessed: 1 }).lean();
        
        if (usersWithEventRefs.length > 0) {
          backupData.collections['UserEventReferences'] = usersWithEventRefs;
        }
      } catch (error) {
        logger.warn(`⚠️  Failed to backup user references: ${error.message}`);
      }
      
      // Write backup to file
      const backupJson = JSON.stringify(backupData, null, 2);
      fs.writeFileSync(backupPath, backupJson, 'utf8');
      
      // Calculate statistics
      const totalRecords = Object.values(backupData.collections).reduce((sum, records) => sum + records.length, 0);
      const totalCollections = Object.keys(backupData.collections).length;
      
      logger.info(`💾 Backup created successfully at: ${backupPath}`);
      logger.info(`💾 Backup contains: ${totalRecords} records across ${totalCollections} collections`);
      logger.info(`💾 Backup size: ${Math.round(backupJson.length / 1024)}KB`);
      
      return {
        success: true,
        backupPath,
        backupId,
        totalRecords,
        totalCollections,
        backupSize: backupJson.length
      };
      
    } catch (error) {
      logger.error(`❌ Backup creation failed:`, error);
      logger.warn(`⚠️  Continuing with deletion despite backup failure`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate deletion is safe to perform
   */
  async validateDeletionSafety(eventId) {
    const checks = {
      hasActiveRegistrations: false,
      hasRecentPayments: false,
      hasOngoingEvent: false,
      requiresAdminApproval: false
    };

    try {
      const Event = require('../models/Event');
      const Registration = require('../models/Registration');
      const Payment = require('../models/Payment');
      
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      // Check for active registrations
      const registrationCount = await Registration.countDocuments({ event: eventId });
      checks.hasActiveRegistrations = registrationCount > 0;

      // Check for recent payments (within 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentPayments = await Payment.countDocuments({
        event: eventId,
        createdAt: { $gte: sevenDaysAgo }
      });
      checks.hasRecentPayments = recentPayments > 0;

      // Check if event is ongoing
      const now = new Date();
      checks.hasOngoingEvent = event.startDate <= now && event.endDate >= now;

      // Require admin approval for events with high activity
      checks.requiresAdminApproval = registrationCount > 100 || recentPayments > 10;

      logger.info('🔍 Deletion safety checks:', checks);
      
      return {
        safe: !checks.requiresAdminApproval,
        checks,
        warnings: this.generateSafetyWarnings(checks)
      };
      
    } catch (error) {
      logger.error('❌ Error performing safety checks:', error);
      throw error;
    }
  }

  /**
   * Generate safety warnings based on checks
   */
  generateSafetyWarnings(checks) {
    const warnings = [];
    
    if (checks.hasActiveRegistrations) {
      warnings.push('⚠️  Event has active registrations that will be permanently deleted');
    }
    
    if (checks.hasRecentPayments) {
      warnings.push('⚠️  Event has recent payments that will be permanently deleted');
    }
    
    if (checks.hasOngoingEvent) {
      warnings.push('🚨 Event is currently ongoing - deletion may disrupt active participants');
    }
    
    if (checks.requiresAdminApproval) {
      warnings.push('🔐 High-activity event requires additional admin approval');
    }
    
    return warnings;
  }

  /**
   * Get deletion statistics
   */
  getStats() {
    return {
      ...this.deletionStats,
      recordCountsObject: Object.fromEntries(this.deletionStats.recordCounts)
    };
  }
}

module.exports = EventDeletionService; 