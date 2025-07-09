const logger = require('../config/logger');
const AuditLog = require('../models/AuditLog');

/**
 * AuditLogService
 * Comprehensive audit logging for event deletion activities
 * Ensures security compliance and forensic tracking
 */
class AuditLogService {
  
  /**
   * Log event deletion scheduling
   */
  static async logDeletionScheduled(eventData, userData, scheduledDeletion, req = null) {
    try {
      const auditEntry = {
        action: 'EVENT_DELETION_SCHEDULED',
        event: eventData._id,
        user: userData.id,
        timestamp: new Date(),
        details: {
          eventName: eventData.name,
          eventId: eventData._id,
          registrationCount: scheduledDeletion.eventMetadata.registrationCount,
          scheduledAt: scheduledDeletion.scheduledAt,
          executeAt: scheduledDeletion.executeAt,
          gracePeriodHours: scheduledDeletion.gracePeriodHours,
          initiatedBy: {
            id: userData.id,
            name: userData.name,
            email: userData.email,
            role: userData.role
          },
          securityChecks: scheduledDeletion.securityChecks,
          userAgent: req?.get('User-Agent'),
          ipAddress: req?.ip || req?.connection?.remoteAddress,
          sessionId: req?.sessionID
        },
        severity: 'HIGH',
        category: 'SECURITY',
        metadata: {
          schedulerId: scheduledDeletion._id,
          venue: eventData.venue,
          dateRange: {
            start: eventData.startDate,
            end: eventData.endDate
          }
        }
      };

      await this.createAuditLog(auditEntry);
      
      logger.warn(`🔒 AUDIT: Event deletion scheduled - ${eventData.name} by ${userData.email}`);
      
    } catch (error) {
      logger.error('❌ Failed to log deletion scheduling:', error);
    }
  }

  /**
   * Log event deletion cancellation
   */
  static async logDeletionCancelled(scheduledDeletion, cancelledByUser, reason) {
    try {
      const auditEntry = {
        action: 'EVENT_DELETION_CANCELLED',
        event: scheduledDeletion.event,
        user: cancelledByUser.id,
        timestamp: new Date(),
        details: {
          eventName: scheduledDeletion.eventMetadata.name,
          eventId: scheduledDeletion.event,
          originallyScheduledAt: scheduledDeletion.scheduledAt,
          originalExecuteAt: scheduledDeletion.executeAt,
          cancelledAt: scheduledDeletion.cancelledAt,
          remainingTimeAtCancellation: scheduledDeletion.getRemainingTime(),
          reason: reason,
          cancelledBy: {
            id: cancelledByUser.id,
            name: cancelledByUser.name,
            email: cancelledByUser.email,
            role: cancelledByUser.role
          },
          originalInitiator: scheduledDeletion.initiatorDetails
        },
        severity: 'MEDIUM',
        category: 'SECURITY',
        metadata: {
          schedulerId: scheduledDeletion._id,
          gracePeriodHours: scheduledDeletion.gracePeriodHours
        }
      };

      await this.createAuditLog(auditEntry);
      
      logger.info(`✅ AUDIT: Event deletion cancelled - ${scheduledDeletion.eventMetadata.name} by ${cancelledByUser.email}`);
      
    } catch (error) {
      logger.error('❌ Failed to log deletion cancellation:', error);
    }
  }

  /**
   * Log event deletion execution started
   */
  static async logDeletionStarted(scheduledDeletion) {
    try {
      const auditEntry = {
        action: 'EVENT_DELETION_STARTED',
        event: scheduledDeletion.event,
        user: scheduledDeletion.initiatedBy,
        timestamp: new Date(),
        details: {
          eventName: scheduledDeletion.eventMetadata.name,
          eventId: scheduledDeletion.event,
          scheduledAt: scheduledDeletion.scheduledAt,
          executeAt: scheduledDeletion.executeAt,
          executionStartedAt: scheduledDeletion.executionStartedAt,
          gracePeriodExpired: true,
          registrationCount: scheduledDeletion.eventMetadata.registrationCount,
          initiatedBy: scheduledDeletion.initiatorDetails,
          securityChecks: scheduledDeletion.securityChecks
        },
        severity: 'CRITICAL',
        category: 'SECURITY',
        metadata: {
          schedulerId: scheduledDeletion._id,
          automaticExecution: true
        }
      };

      await this.createAuditLog(auditEntry);
      
      logger.error(`🔥 AUDIT: Event deletion STARTED - ${scheduledDeletion.eventMetadata.name}`);
      
    } catch (error) {
      logger.error('❌ Failed to log deletion start:', error);
    }
  }

  /**
   * Log event deletion execution completed
   */
  static async logDeletionCompleted(scheduledDeletion, deletionStats) {
    try {
      const auditEntry = {
        action: 'EVENT_DELETION_COMPLETED',
        event: scheduledDeletion.event,
        user: scheduledDeletion.initiatedBy,
        timestamp: new Date(),
        details: {
          eventName: scheduledDeletion.eventMetadata.name,
          eventId: scheduledDeletion.event,
          executionStartedAt: scheduledDeletion.executionStartedAt,
          executionCompletedAt: scheduledDeletion.executionCompletedAt,
          duration: scheduledDeletion.executionCompletedAt - scheduledDeletion.executionStartedAt,
          totalRecordsDeleted: deletionStats.totalRecords,
          totalCollectionsAffected: deletionStats.totalCollections,
          collectionsDeleted: deletionStats.collectionsDeleted,
          recordCounts: Object.fromEntries(deletionStats.recordCounts),
          deletionDuration: deletionStats.duration,
          initiatedBy: scheduledDeletion.initiatorDetails,
          IRREVERSIBLE: true,
          DATA_PERMANENTLY_DESTROYED: true
        },
        severity: 'CRITICAL',
        category: 'SECURITY',
        metadata: {
          schedulerId: scheduledDeletion._id,
          completionStatus: 'SUCCESS',
          backupCreated: !deletionStats.skipBackup,
          collectionsAffected: deletionStats.collectionsDeleted
        }
      };

      await this.createAuditLog(auditEntry);
      
      logger.error(`💀 AUDIT: Event deletion COMPLETED - ${scheduledDeletion.eventMetadata.name} - ${deletionStats.totalRecords} records destroyed`);
      
    } catch (error) {
      logger.error('❌ Failed to log deletion completion:', error);
    }
  }

  /**
   * Log event deletion execution failed
   */
  static async logDeletionFailed(scheduledDeletion, error) {
    try {
      const auditEntry = {
        action: 'EVENT_DELETION_FAILED',
        event: scheduledDeletion.event,
        user: scheduledDeletion.initiatedBy,
        timestamp: new Date(),
        details: {
          eventName: scheduledDeletion.eventMetadata.name,
          eventId: scheduledDeletion.event,
          executionStartedAt: scheduledDeletion.executionStartedAt,
          executionFailedAt: scheduledDeletion.executionFailedAt,
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name
          },
          partialDeletion: true,
          dataIntegrityRisk: true,
          initiatedBy: scheduledDeletion.initiatorDetails
        },
        severity: 'CRITICAL',
        category: 'SECURITY',
        metadata: {
          schedulerId: scheduledDeletion._id,
          completionStatus: 'FAILED',
          requiresManualCleanup: true
        }
      };

      await this.createAuditLog(auditEntry);
      
      logger.error(`❌ AUDIT: Event deletion FAILED - ${scheduledDeletion.eventMetadata.name} - Manual cleanup required`);
      
    } catch (auditError) {
      logger.error('❌ Failed to log deletion failure:', auditError);
    }
  }

  /**
   * Log immediate force deletion (admin override)
   */
  static async logForceDeletion(eventData, userData, deletionStats, req = null) {
    try {
      const auditEntry = {
        action: 'EVENT_FORCE_DELETION',
        event: eventData._id,
        user: userData.id,
        timestamp: new Date(),
        details: {
          eventName: eventData.name,
          eventId: eventData._id,
          forceDeletedBy: {
            id: userData.id,
            name: userData.name,
            email: userData.email,
            role: userData.role
          },
          BYPASS_SECURITY_LOCKDOWN: true,
          NO_GRACE_PERIOD: true,
          totalRecordsDeleted: deletionStats.totalRecords,
          totalCollectionsAffected: deletionStats.totalCollections,
          collectionsDeleted: deletionStats.collectionsDeleted,
          recordCounts: Object.fromEntries(deletionStats.recordCounts),
          deletionDuration: deletionStats.duration,
          userAgent: req?.get('User-Agent'),
          ipAddress: req?.ip || req?.connection?.remoteAddress,
          sessionId: req?.sessionID,
          IRREVERSIBLE: true,
          DATA_PERMANENTLY_DESTROYED: true
        },
        severity: 'CRITICAL',
        category: 'SECURITY',
        metadata: {
          adminOverride: true,
          bypassedSecurity: true,
          immediateExecution: true,
          collectionsAffected: deletionStats.collectionsDeleted
        }
      };

      await this.createAuditLog(auditEntry);
      
      logger.error(`🚨 AUDIT: FORCE DELETION - ${eventData.name} by admin ${userData.email} - ${deletionStats.totalRecords} records destroyed immediately`);
      
    } catch (error) {
      logger.error('❌ Failed to log force deletion:', error);
    }
  }

  /**
   * Log access to deletion status
   */
  static async logDeletionStatusAccess(eventId, userEmail, hasScheduledDeletion) {
    try {
      const auditEntry = {
        action: 'EVENT_DELETION_STATUS_ACCESSED',
        event: eventId,
        user: null, // Will be populated if user ID available
        timestamp: new Date(),
        details: {
          eventId: eventId,
          accessedBy: userEmail,
          hasScheduledDeletion: hasScheduledDeletion
        },
        severity: 'LOW',
        category: 'ACCESS'
      };

      await this.createAuditLog(auditEntry);
      
    } catch (error) {
      logger.error('❌ Failed to log status access:', error);
    }
  }

  /**
   * Log security check results
   */
  static async logSecurityChecks(eventId, eventName, securityChecks, userEmail) {
    try {
      const warningLevel = securityChecks.requiresAdminApproval ? 'HIGH' : 
                          (securityChecks.hasActiveRegistrations || securityChecks.hasRecentPayments) ? 'MEDIUM' : 'LOW';

      const auditEntry = {
        action: 'EVENT_DELETION_SECURITY_CHECK',
        event: eventId,
        timestamp: new Date(),
        details: {
          eventId: eventId,
          eventName: eventName,
          checkedBy: userEmail,
          securityChecks: securityChecks,
          riskLevel: warningLevel,
          checksPerformedAt: new Date()
        },
        severity: warningLevel,
        category: 'SECURITY'
      };

      await this.createAuditLog(auditEntry);
      
      if (warningLevel === 'HIGH') {
        logger.warn(`⚠️  AUDIT: High-risk deletion attempt - ${eventName} by ${userEmail}`);
      }
      
    } catch (error) {
      logger.error('❌ Failed to log security checks:', error);
    }
  }

  /**
   * Create audit log entry
   */
  static async createAuditLog(auditData) {
    try {
      // Create audit log in database
      const auditLog = new AuditLog(auditData);
      await auditLog.save();

      // Also log to file system for redundancy
      const logMessage = `[AUDIT] ${auditData.action} - Event: ${auditData.details?.eventName || auditData.event} - User: ${auditData.details?.initiatedBy?.email || auditData.details?.accessedBy || 'System'} - Severity: ${auditData.severity}`;
      
      switch (auditData.severity) {
        case 'CRITICAL':
          logger.error(logMessage);
          break;
        case 'HIGH':
          logger.warn(logMessage);
          break;
        case 'MEDIUM':
          logger.info(logMessage);
          break;
        default:
          logger.debug(logMessage);
      }

      return auditLog;
      
    } catch (error) {
      // If audit logging fails, we must still log this failure
      logger.error('🚨 CRITICAL: Audit logging failed - This is a security compliance issue!', error);
      
      // Try to log to file system at minimum
      const emergencyLog = `[AUDIT FAILURE] Failed to log: ${auditData.action} - Event: ${auditData.event} - Error: ${error.message}`;
      logger.error(emergencyLog);
      
      throw error;
    }
  }

  /**
   * Get audit trail for an event
   */
  static async getEventAuditTrail(eventId, limit = 50) {
    try {
      const auditLogs = await AuditLog.find({ event: eventId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return auditLogs;
      
    } catch (error) {
      logger.error('❌ Failed to retrieve audit trail:', error);
      throw error;
    }
  }

  /**
   * Get deletion audit summary
   */
  static async getDeletionAuditSummary(timeframe = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeframe);

      const summary = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: cutoffDate },
            action: { $regex: /^EVENT_DELETION_/ }
          }
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            lastOccurrence: { $max: '$timestamp' },
            severities: { $push: '$severity' }
          }
        },
        {
          $sort: { lastOccurrence: -1 }
        }
      ]);

      return {
        timeframe: `${timeframe} days`,
        summary: summary,
        totalDeletionActivities: summary.reduce((sum, item) => sum + item.count, 0)
      };
      
    } catch (error) {
      logger.error('❌ Failed to get deletion audit summary:', error);
      throw error;
    }
  }

  /**
   * Check for suspicious deletion patterns
   */
  static async detectSuspiciousActivity(timeframe = 24) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - timeframe);

      // Check for multiple deletions by same user
      const userActivity = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: cutoffDate },
            action: { $in: ['EVENT_DELETION_SCHEDULED', 'EVENT_FORCE_DELETION'] }
          }
        },
        {
          $group: {
            _id: '$details.initiatedBy.email',
            count: { $sum: 1 },
            events: { $push: '$details.eventName' },
            actions: { $push: '$action' }
          }
        },
        {
          $match: { count: { $gte: 3 } } // 3 or more deletions
        }
      ]);

      const alerts = [];
      
      if (userActivity.length > 0) {
        userActivity.forEach(activity => {
          alerts.push({
            type: 'MULTIPLE_DELETIONS',
            severity: 'HIGH',
            user: activity._id,
            count: activity.count,
            timeframe: `${timeframe} hours`,
            events: activity.events
          });
        });
      }

      return alerts;
      
    } catch (error) {
      logger.error('❌ Failed to detect suspicious activity:', error);
      throw error;
    }
  }
}

module.exports = AuditLogService; 