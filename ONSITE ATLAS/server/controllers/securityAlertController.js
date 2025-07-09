const SecurityAlert = require('../models/SecurityAlert');
const AuditLog = require('../models/AuditLog');
const NotificationService = require('../services/NotificationService');
const logger = require('../utils/logger');

class SecurityAlertController {
  // Get all security alerts with filtering and pagination
  async getAllAlerts(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        severity,
        type,
        assignedTo,
        sourceIP,
        days = 30,
        sortBy = 'firstDetected',
        sortOrder = 'desc'
      } = req.query;

      const filters = {};
      
      // Apply filters
      if (status) filters.status = status;
      if (severity) filters.severity = severity;
      if (type) filters.type = type;
      if (assignedTo) filters.assignedTo = assignedTo;
      if (sourceIP) filters.sourceIP = sourceIP;
      
      // Date filter
      if (days) {
        const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
        filters.firstDetected = { $gte: since };
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        populate: [
          { path: 'userId', select: 'email firstName lastName' },
          { path: 'assignedTo', select: 'email firstName lastName' },
          { path: 'resolvedBy', select: 'email firstName lastName' }
        ]
      };

      const alerts = await SecurityAlert.paginate(filters, options);

      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      logger.error('Failed to fetch security alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch security alerts',
        error: error.message
      });
    }
  }

  // Get security alert by ID
  async getAlertById(req, res) {
    try {
      const { alertId } = req.params;

      const alert = await SecurityAlert.findById(alertId)
        .populate('userId', 'email firstName lastName')
        .populate('assignedTo', 'email firstName lastName')
        .populate('resolvedBy', 'email firstName lastName')
        .populate('evidence.auditLogId');

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Security alert not found'
        });
      }

      res.json({
        success: true,
        data: alert
      });
    } catch (error) {
      logger.error('Failed to fetch security alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch security alert',
        error: error.message
      });
    }
  }

  // Create new security alert
  async createAlert(req, res) {
    try {
      const alertData = req.body;
      alertData.userId = req.user?.id; // Set from authenticated user if available

      const alert = await SecurityAlert.createAlert(alertData);

      // Send notifications for high severity alerts
      if (alert.severity === 'high' || alert.severity === 'critical') {
        await this.sendAlertNotifications(alert);
      }

      // Log the alert creation
      await AuditLog.create({
        userId: req.user?.id,
        action: 'security_alert_created',
        resource: 'SecurityAlert',
        resourceId: alert._id,
        details: {
          alertType: alert.type,
          severity: alert.severity,
          title: alert.title
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json({
        success: true,
        data: alert,
        message: 'Security alert created successfully'
      });
    } catch (error) {
      logger.error('Failed to create security alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create security alert',
        error: error.message
      });
    }
  }

  // Update security alert
  async updateAlert(req, res) {
    try {
      const { alertId } = req.params;
      const updates = req.body;

      const alert = await SecurityAlert.findById(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Security alert not found'
        });
      }

      // Apply updates
      Object.assign(alert, updates);
      await alert.save();

      // Log the update
      await AuditLog.create({
        userId: req.user.id,
        action: 'security_alert_updated',
        resource: 'SecurityAlert',
        resourceId: alert._id,
        details: { updates },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: alert,
        message: 'Security alert updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update security alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update security alert',
        error: error.message
      });
    }
  }

  // Assign alert to user
  async assignAlert(req, res) {
    try {
      const { alertId } = req.params;
      const { assignedTo } = req.body;

      const alert = await SecurityAlert.findById(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Security alert not found'
        });
      }

      alert.assignTo(assignedTo);
      await alert.save();

      // Send assignment notification
      await NotificationService.sendNotification({
        userId: assignedTo,
        type: 'security_alert_assigned',
        title: 'Security Alert Assigned',
        message: `You have been assigned security alert: ${alert.title}`,
        metadata: { alertId: alert._id }
      });

      // Log the assignment
      await AuditLog.create({
        userId: req.user.id,
        action: 'security_alert_assigned',
        resource: 'SecurityAlert',
        resourceId: alert._id,
        details: { assignedTo },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: alert,
        message: 'Security alert assigned successfully'
      });
    } catch (error) {
      logger.error('Failed to assign security alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign security alert',
        error: error.message
      });
    }
  }

  // Resolve security alert
  async resolveAlert(req, res) {
    try {
      const { alertId } = req.params;
      const { resolutionNotes } = req.body;

      const alert = await SecurityAlert.findById(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Security alert not found'
        });
      }

      alert.resolve(req.user.id, resolutionNotes);
      await alert.save();

      // Log the resolution
      await AuditLog.create({
        userId: req.user.id,
        action: 'security_alert_resolved',
        resource: 'SecurityAlert',
        resourceId: alert._id,
        details: { resolutionNotes },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: alert,
        message: 'Security alert resolved successfully'
      });
    } catch (error) {
      logger.error('Failed to resolve security alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve security alert',
        error: error.message
      });
    }
  }

  // Escalate security alert
  async escalateAlert(req, res) {
    try {
      const { alertId } = req.params;

      const alert = await SecurityAlert.findById(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Security alert not found'
        });
      }

      const previousSeverity = alert.severity;
      alert.escalate(req.user.id);
      await alert.save();

      // Send escalation notifications
      if (alert.severity === 'critical') {
        await this.sendCriticalAlertNotifications(alert);
      }

      // Log the escalation
      await AuditLog.create({
        userId: req.user.id,
        action: 'security_alert_escalated',
        resource: 'SecurityAlert',
        resourceId: alert._id,
        details: { 
          previousSeverity,
          newSeverity: alert.severity
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: alert,
        message: 'Security alert escalated successfully'
      });
    } catch (error) {
      logger.error('Failed to escalate security alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to escalate security alert',
        error: error.message
      });
    }
  }

  // Add evidence to alert
  async addEvidence(req, res) {
    try {
      const { alertId } = req.params;
      const { type, description, auditLogId } = req.body;

      const alert = await SecurityAlert.findById(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Security alert not found'
        });
      }

      alert.addEvidence({
        type,
        description,
        auditLogId
      });
      await alert.save();

      // Log the evidence addition
      await AuditLog.create({
        userId: req.user.id,
        action: 'security_alert_evidence_added',
        resource: 'SecurityAlert',
        resourceId: alert._id,
        details: { type, description },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: alert,
        message: 'Evidence added successfully'
      });
    } catch (error) {
      logger.error('Failed to add evidence:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add evidence',
        error: error.message
      });
    }
  }

  // Suppress alert for specified duration
  async suppressAlert(req, res) {
    try {
      const { alertId } = req.params;
      const { hours = 24 } = req.body;

      const alert = await SecurityAlert.findById(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Security alert not found'
        });
      }

      alert.suppress(hours);
      await alert.save();

      // Log the suppression
      await AuditLog.create({
        userId: req.user.id,
        action: 'security_alert_suppressed',
        resource: 'SecurityAlert',
        resourceId: alert._id,
        details: { hours },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: alert,
        message: `Security alert suppressed for ${hours} hours`
      });
    } catch (error) {
      logger.error('Failed to suppress security alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to suppress security alert',
        error: error.message
      });
    }
  }

  // Get security dashboard data
  async getDashboard(req, res) {
    try {
      const { days = 30 } = req.query;
      const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

      // Get summary statistics
      const [
        activeAlerts,
        criticalAlerts,
        unassignedAlerts,
        alertTrends,
        topSources,
        severityDistribution
      ] = await Promise.all([
        SecurityAlert.countDocuments({ status: 'active' }),
        SecurityAlert.countDocuments({ 
          severity: 'critical', 
          status: { $in: ['active', 'investigating'] } 
        }),
        SecurityAlert.countDocuments({ 
          assignedTo: null, 
          status: { $in: ['active', 'investigating'] } 
        }),
        SecurityAlert.getAlertTrends(days),
        SecurityAlert.aggregate([
          { $match: { firstDetected: { $gte: since } } },
          { $group: { _id: '$sourceIP', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        SecurityAlert.aggregate([
          { $match: { firstDetected: { $gte: since } } },
          { $group: { _id: '$severity', count: { $sum: 1 } } }
        ])
      ]);

      // Get recent alerts
      const recentAlerts = await SecurityAlert.find({
        firstDetected: { $gte: since }
      })
      .sort({ firstDetected: -1 })
      .limit(10)
      .populate('userId', 'email firstName lastName')
      .populate('assignedTo', 'email firstName lastName');

      res.json({
        success: true,
        data: {
          summary: {
            activeAlerts,
            criticalAlerts,
            unassignedAlerts,
            totalAlerts: activeAlerts + criticalAlerts + unassignedAlerts
          },
          trends: alertTrends,
          topSources,
          severityDistribution,
          recentAlerts
        }
      });
    } catch (error) {
      logger.error('Failed to fetch security dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch security dashboard',
        error: error.message
      });
    }
  }

  // Get alerts by IP address
  async getAlertsByIP(req, res) {
    try {
      const { ip } = req.params;
      const { days = 30 } = req.query;

      const alerts = await SecurityAlert.getAlertsByIP(ip, days);

      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      logger.error('Failed to fetch alerts by IP:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch alerts by IP',
        error: error.message
      });
    }
  }

  // Get alerts by user
  async getAlertsByUser(req, res) {
    try {
      const { userId } = req.params;
      const { days = 30 } = req.query;

      const alerts = await SecurityAlert.getAlertsByUser(userId, days);

      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      logger.error('Failed to fetch alerts by user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch alerts by user',
        error: error.message
      });
    }
  }

  // Delete security alert (admin only)
  async deleteAlert(req, res) {
    try {
      const { alertId } = req.params;

      const alert = await SecurityAlert.findById(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Security alert not found'
        });
      }

      await SecurityAlert.findByIdAndDelete(alertId);

      // Log the deletion
      await AuditLog.create({
        userId: req.user.id,
        action: 'security_alert_deleted',
        resource: 'SecurityAlert',
        resourceId: alertId,
        details: { 
          alertType: alert.type,
          severity: alert.severity,
          title: alert.title
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Security alert deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete security alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete security alert',
        error: error.message
      });
    }
  }

  // Helper method to send alert notifications
  async sendAlertNotifications(alert) {
    try {
      // Get admin users for notifications
      const User = require('../models/User');
      const adminUsers = await User.find({ 
        role: { $in: ['admin', 'security_admin'] },
        isActive: true 
      });

      // Send notifications to all admin users
      for (const admin of adminUsers) {
        await NotificationService.sendNotification({
          userId: admin._id,
          type: 'security_alert',
          title: `${alert.severity.toUpperCase()} Security Alert`,
          message: alert.title,
          metadata: { 
            alertId: alert._id,
            severity: alert.severity,
            type: alert.type
          }
        });
      }

      // For critical alerts, also send email/SMS
      if (alert.severity === 'critical') {
        await this.sendCriticalAlertNotifications(alert);
      }
    } catch (error) {
      logger.error('Failed to send alert notifications:', error);
    }
  }

  // Helper method to send critical alert notifications
  async sendCriticalAlertNotifications(alert) {
    try {
      // Implementation depends on your notification providers
      // This could send SMS, email, Slack messages, etc.
      logger.warn(`CRITICAL SECURITY ALERT: ${alert.title}`, {
        alertId: alert._id,
        type: alert.type,
        sourceIP: alert.sourceIP,
        userId: alert.userId
      });
    } catch (error) {
      logger.error('Failed to send critical alert notifications:', error);
    }
  }
}

module.exports = new SecurityAlertController();
