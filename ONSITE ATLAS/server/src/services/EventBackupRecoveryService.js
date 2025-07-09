const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

/**
 * EventBackupRecoveryService
 * Handles recovery of event data from backup files created during deletion
 */
class EventBackupRecoveryService {
  constructor() {
    this.backupDir = path.join('./backups/event_deletions');
  }

  /**
   * List all available backup files
   */
  async listBackups() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }

      const files = fs.readdirSync(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          
          try {
            const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            backups.push({
              filename: file,
              backupId: backupData.metadata?.backupId || 'unknown',
              eventId: backupData.metadata?.eventId || 'unknown',
              eventName: backupData.metadata?.eventName || 'unknown',
              backupDate: backupData.metadata?.backupDate || stats.mtime.toISOString(),
              fileSize: stats.size,
              fileSizeFormatted: this.formatFileSize(stats.size),
              collections: Object.keys(backupData.collections || {}),
              totalRecords: Object.values(backupData.collections || {}).reduce((sum, records) => sum + records.length, 0)
            });
          } catch (error) {
            logger.warn(`⚠️  Invalid backup file: ${file}`);
          }
        }
      }

      return backups.sort((a, b) => new Date(b.backupDate) - new Date(a.backupDate));
    } catch (error) {
      logger.error('❌ Error listing backups:', error);
      throw error;
    }
  }

  /**
   * Get details of a specific backup
   */
  async getBackupDetails(backupId) {
    try {
      const backups = await this.listBackups();
      const backup = backups.find(b => b.backupId === backupId || b.filename.includes(backupId));
      
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      const filePath = path.join(this.backupDir, backup.filename);
      const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      return {
        ...backup,
        metadata: backupData.metadata,
        collectionDetails: Object.keys(backupData.collections).map(collection => ({
          collection,
          recordCount: backupData.collections[collection].length,
          sampleRecord: backupData.collections[collection][0] || null
        }))
      };
    } catch (error) {
      logger.error('❌ Error getting backup details:', error);
      throw error;
    }
  }

  /**
   * Restore event data from backup
   */
  async restoreFromBackup(backupId, options = {}) {
    const {
      dryRun = false,
      specificCollections = null,
      newEventId = null,
      skipExistingRecords = true
    } = options;

    try {
      const backup = await this.getBackupDetails(backupId);
      const filePath = path.join(this.backupDir, backup.filename);
      const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      logger.info(`🔄 ${dryRun ? '[DRY RUN] ' : ''}Starting restoration from backup: ${backupId}`);
      logger.info(`📊 Original event: ${backupData.metadata.eventName} (${backupData.metadata.eventId})`);

      const stats = {
        collectionsProcessed: 0,
        recordsRestored: 0,
        recordsSkipped: 0,
        errors: []
      };

      // Restore main event first
      const eventId = newEventId || backupData.metadata.eventId;
      
      if (!dryRun) {
        const Event = require('../models/Event');
        const existingEvent = await Event.findById(eventId);
        
        if (existingEvent && skipExistingRecords) {
          logger.warn(`⚠️  Event ${eventId} already exists - skipping event restoration`);
        } else {
          const eventData = { ...backupData.eventDocument };
          if (newEventId) {
            eventData._id = newEventId;
          }
          
          await Event.findByIdAndUpdate(eventId, eventData, { upsert: true, new: true });
          logger.info(`✅ Restored main event document: ${eventData.name}`);
        }
      }

      // Restore collections
      const collectionsToRestore = specificCollections || Object.keys(backupData.collections);
      
      for (const collectionName of collectionsToRestore) {
        if (!backupData.collections[collectionName]) {
          logger.warn(`⚠️  Collection ${collectionName} not found in backup`);
          continue;
        }

        try {
          await this.restoreCollection(
            collectionName, 
            backupData.collections[collectionName], 
            eventId,
            backupData.metadata.eventId,
            { dryRun, skipExistingRecords }
          );
          
          stats.collectionsProcessed++;
          stats.recordsRestored += backupData.collections[collectionName].length;
          
        } catch (error) {
          logger.error(`❌ Error restoring collection ${collectionName}:`, error);
          stats.errors.push({
            collection: collectionName,
            error: error.message
          });
        }
      }

      logger.info(`✅ Restoration completed!`);
      logger.info(`📊 Collections processed: ${stats.collectionsProcessed}`);
      logger.info(`📊 Records restored: ${stats.recordsRestored}`);
      if (stats.errors.length > 0) {
        logger.warn(`⚠️  Errors encountered: ${stats.errors.length}`);
      }

      return stats;

    } catch (error) {
      logger.error('❌ Error during restoration:', error);
      throw error;
    }
  }

  /**
   * Restore a specific collection
   */
  async restoreCollection(collectionName, records, newEventId, originalEventId, options = {}) {
    const { dryRun = false, skipExistingRecords = true } = options;
    
    try {
      // Skip UserEventReferences - handle separately
      if (collectionName === 'UserEventReferences') {
        return this.restoreUserEventReferences(records, newEventId, originalEventId, options);
      }

      const Model = require(`../models/${collectionName}`);
      
      logger.info(`🔄 ${dryRun ? '[DRY RUN] ' : ''}Restoring ${records.length} records to ${collectionName}`);
      
      if (!dryRun) {
        for (const record of records) {
          // Update event reference if using new event ID
          if (newEventId && newEventId !== originalEventId) {
            record.event = newEventId;
          }

          if (skipExistingRecords) {
            const existing = await Model.findById(record._id);
            if (existing) {
              logger.debug(`⏭️  Skipping existing record: ${record._id}`);
              continue;
            }
          }

          await Model.findByIdAndUpdate(record._id, record, { upsert: true, new: true });
        }
      }
      
      logger.info(`✅ ${dryRun ? '[DRY RUN] ' : ''}Restored ${records.length} records to ${collectionName}`);
      
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        logger.warn(`⚠️  Model ${collectionName} not found - skipping`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Restore user event references
   */
  async restoreUserEventReferences(userRefs, newEventId, originalEventId, options = {}) {
    const { dryRun = false } = options;
    
    try {
      const User = require('../models/User');
      
      logger.info(`🔄 ${dryRun ? '[DRY RUN] ' : ''}Restoring event references for ${userRefs.length} users`);
      
      if (!dryRun) {
        for (const userRef of userRefs) {
          const updateData = {};
          
          if (userRef.activeEvent && userRef.activeEvent.toString() === originalEventId) {
            updateData.activeEvent = newEventId;
          }
          if (userRef.lastEventAccessed && userRef.lastEventAccessed.toString() === originalEventId) {
            updateData.lastEventAccessed = newEventId;
          }
          
          if (Object.keys(updateData).length > 0) {
            await User.findByIdAndUpdate(userRef._id, updateData);
          }
        }
      }
      
      logger.info(`✅ ${dryRun ? '[DRY RUN] ' : ''}Restored user event references`);
      
    } catch (error) {
      logger.error('❌ Error restoring user event references:', error);
    }
  }

  /**
   * Delete a backup file
   */
  async deleteBackup(backupId) {
    try {
      const backups = await this.listBackups();
      const backup = backups.find(b => b.backupId === backupId || b.filename.includes(backupId));
      
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      const filePath = path.join(this.backupDir, backup.filename);
      fs.unlinkSync(filePath);
      
      logger.info(`🗑️  Deleted backup file: ${backup.filename}`);
      return true;
      
    } catch (error) {
      logger.error('❌ Error deleting backup:', error);
      throw error;
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = EventBackupRecoveryService; 