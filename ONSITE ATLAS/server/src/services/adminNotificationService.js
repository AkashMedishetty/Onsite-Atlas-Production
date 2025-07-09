const AdminNotification = require('../models/AdminNotification');
const { sendNotificationToUser, sendNotificationToAdmins } = require('../websocket');
const User = require('../models/User');

class AdminNotificationService {
  
  // Create a notification with automatic WebSocket delivery
  static async createNotification(data) {
    try {
      const notification = await AdminNotification.createNotification(data);
      console.log(`📢 Notification created: ${notification.title} for user ${data.userId}`);
      return notification;
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      throw error;
    }
  }

  // Registration-related notifications
  static async notifyNewRegistration(registration, eventDetails, adminUserId) {
    const notificationData = {
      title: 'New Registration Received',
      message: `${registration.personalInfo?.firstName || registration.firstName || 'Someone'} registered for ${eventDetails.name}`,
      type: 'registration',
      priority: 'normal',
      userId: adminUserId,
      eventId: eventDetails._id,
      registrationId: registration._id,
      actionUrl: `/events/${eventDetails._id}/registrations?viewRegistration=${registration._id}`,
      actionType: 'navigate',
      metadata: new Map([
        ['registrantName', `${registration.personalInfo?.firstName || registration.firstName || ''} ${registration.personalInfo?.lastName || registration.lastName || ''}`.trim()],
        ['registrantEmail', registration.personalInfo?.email || registration.email],
        ['eventName', eventDetails.name],
        ['registrationId', registration.registrationId]
      ])
    };

    return this.createNotification(notificationData);
  }

  static async notifyRegistrationStatusChange(registration, newStatus, eventDetails, adminUserId) {
    const statusMessages = {
      'active': 'Registration activated',
      'cancelled': 'Registration cancelled',
      'no-show': 'Registration marked as no-show'
    };

    const priorities = {
      'cancelled': 'high',
      'no-show': 'high',
      'active': 'normal'
    };

    const notificationData = {
      title: 'Registration Status Updated',
      message: `${registration.personalInfo?.firstName || registration.firstName || 'Registration'} ${registration.registrationId} ${statusMessages[newStatus] || `changed to ${newStatus}`}`,
      type: 'registration',
      priority: priorities[newStatus] || 'normal',
      userId: adminUserId,
      eventId: eventDetails._id,
      registrationId: registration._id,
      actionUrl: `/events/${eventDetails._id}/registrations?viewRegistration=${registration._id}`,
      actionType: 'navigate',
      metadata: new Map([
        ['previousStatus', registration.status],
        ['newStatus', newStatus],
        ['registrantName', `${registration.personalInfo?.firstName || registration.firstName || ''} ${registration.personalInfo?.lastName || registration.lastName || ''}`.trim()],
        ['eventName', eventDetails.name]
      ])
    };

    return this.createNotification(notificationData);
  }

  // Payment-related notifications
  static async notifyPaymentReceived(payment, registration, eventDetails, adminUserId) {
    const notificationData = {
      title: 'Payment Received',
      message: `Payment of $${payment.amount} received from ${registration.personalInfo?.firstName || registration.firstName || 'registrant'} for ${eventDetails.name}`,
      type: 'payment',
      priority: 'normal',
      userId: adminUserId,
      eventId: eventDetails._id,
      registrationId: registration._id,
      paymentId: payment._id,
      actionUrl: `/events/${eventDetails._id}/payments`,
      actionType: 'navigate',
      metadata: new Map([
        ['amount', payment.amount],
        ['currency', payment.currency || 'USD'],
        ['paymentMethod', payment.method],
        ['registrantName', `${registration.personalInfo?.firstName || registration.firstName || ''} ${registration.personalInfo?.lastName || registration.lastName || ''}`.trim()],
        ['eventName', eventDetails.name]
      ])
    };

    return this.createNotification(notificationData);
  }

  static async notifyPaymentFailed(payment, registration, eventDetails, adminUserId) {
    const notificationData = {
      title: 'Payment Failed',
      message: `Payment of $${payment.amount} failed for ${registration.personalInfo?.firstName || registration.firstName || 'registrant'} - ${payment.failureReason || 'Unknown reason'}`,
      type: 'alert',
      priority: 'high',
      userId: adminUserId,
      eventId: eventDetails._id,
      registrationId: registration._id,
      paymentId: payment._id,
      actionUrl: `/events/${eventDetails._id}/payments`,
      actionType: 'navigate',
      metadata: new Map([
        ['amount', payment.amount],
        ['failureReason', payment.failureReason],
        ['registrantName', `${registration.personalInfo?.firstName || registration.firstName || ''} ${registration.personalInfo?.lastName || registration.lastName || ''}`.trim()],
        ['eventName', eventDetails.name]
      ])
    };

    return this.createNotification(notificationData);
  }

  // Abstract-related notifications
  static async notifyNewAbstract(abstract, eventDetails, adminUserId) {
    const notificationData = {
      title: 'New Abstract Submitted',
      message: `"${abstract.title}" submitted by ${abstract.authors?.[0]?.name || abstract.submittedBy || 'Unknown author'}`,
      type: 'abstract',
      priority: 'normal',
      userId: adminUserId,
      eventId: eventDetails._id,
      abstractId: abstract._id,
      actionUrl: `/events/${eventDetails._id}/abstracts/${abstract._id}`,
      actionType: 'navigate',
      metadata: new Map([
        ['abstractTitle', abstract.title],
        ['authorName', abstract.authors?.[0]?.name],
        ['submissionType', abstract.submissionType],
        ['eventName', eventDetails.name]
      ])
    };

    return this.createNotification(notificationData);
  }

  static async notifyAbstractReviewCompleted(abstract, review, eventDetails, adminUserId) {
    const notificationData = {
      title: 'Abstract Review Completed',
      message: `"${abstract.title}" reviewed with decision: ${review.decision}`,
      type: 'abstract',
      priority: 'normal',
      userId: adminUserId,
      eventId: eventDetails._id,
      abstractId: abstract._id,
      actionUrl: `/events/${eventDetails._id}/abstracts/${abstract._id}`,
      actionType: 'navigate',
      metadata: new Map([
        ['abstractTitle', abstract.title],
        ['reviewDecision', review.decision],
        ['reviewerName', review.reviewerName],
        ['eventName', eventDetails.name]
      ])
    };

    return this.createNotification(notificationData);
  }

  // System and alert notifications
  static async notifySystemAlert(title, message, priority = 'high', adminUserId, metadata = {}) {
    const notificationData = {
      title: title,
      message: message,
      type: 'alert',
      priority: priority,
      userId: adminUserId,
      actionType: 'none',
      metadata: new Map(Object.entries(metadata))
    };

    return this.createNotification(notificationData);
  }

  static async notifyBulkImportCompleted(importResults, eventDetails, adminUserId) {
    const { successful, failed, total } = importResults;
    
    const notificationData = {
      title: 'Bulk Import Completed',
      message: `Imported ${successful}/${total} registrations successfully for ${eventDetails.name}${failed > 0 ? ` (${failed} failed)` : ''}`,
      type: failed > 0 ? 'alert' : 'success',
      priority: failed > 0 ? 'high' : 'normal',
      userId: adminUserId,
      eventId: eventDetails._id,
      actionUrl: `/events/${eventDetails._id}/registrations`,
      actionType: 'navigate',
      metadata: new Map([
        ['totalRecords', total],
        ['successfulImports', successful],
        ['failedImports', failed],
        ['eventName', eventDetails.name]
      ])
    };

    return this.createNotification(notificationData);
  }

  static async notifyEventCapacityWarning(eventDetails, currentCount, capacity, adminUserId) {
    const percentage = Math.round((currentCount / capacity) * 100);
    
    const notificationData = {
      title: 'Event Capacity Warning',
      message: `${eventDetails.name} is ${percentage}% full (${currentCount}/${capacity} registrations)`,
      type: 'alert',
      priority: percentage >= 95 ? 'critical' : 'high',
      userId: adminUserId,
      eventId: eventDetails._id,
      actionUrl: `/events/${eventDetails._id}/registrations`,
      actionType: 'navigate',
      metadata: new Map([
        ['currentRegistrations', currentCount],
        ['totalCapacity', capacity],
        ['percentageFull', percentage],
        ['eventName', eventDetails.name]
      ])
    };

    return this.createNotification(notificationData);
  }

  // Utility methods for bulk operations
  static async notifyMultipleAdmins(notificationData, adminUserIds) {
    const notifications = [];
    
    for (const adminUserId of adminUserIds) {
      const notification = await this.createNotification({
        ...notificationData,
        userId: adminUserId
      });
      notifications.push(notification);
    }
    
    return notifications;
  }

  static async getAllAdminUsers() {
    return User.find({ 
      role: { $in: ['admin', 'super_admin'] },
      isActive: true 
    }).select('_id email role');
  }

  static async notifyAllAdmins(notificationData) {
    const adminUsers = await this.getAllAdminUsers();
    const adminUserIds = adminUsers.map(user => user._id.toString());
    
    return this.notifyMultipleAdmins(notificationData, adminUserIds);
  }

  // Analytics and reporting notifications
  static async notifyDailyReport(reportData, adminUserId) {
    const { date, registrations, payments, events } = reportData;
    
    const notificationData = {
      title: 'Daily Report Available',
      message: `Daily report for ${date}: ${registrations} new registrations, $${payments} in payments across ${events} events`,
      type: 'info',
      priority: 'low',
      userId: adminUserId,
      actionUrl: '/reports/daily',
      actionType: 'navigate',
      metadata: new Map(Object.entries(reportData))
    };

    return this.createNotification(notificationData);
  }

  // Cleanup and maintenance
  static async cleanupOldNotifications(olderThanDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await AdminNotification.deleteMany({
      createdAt: { $lt: cutoffDate },
      priority: { $ne: 'critical' }, // Keep critical notifications longer
      read: true // Only delete read notifications
    });
    
    console.log(`🧹 Cleaned up ${result.deletedCount} old notifications`);
    return result;
  }

  // Get notification statistics
  static async getNotificationStats(userId, timeframe = '7d') {
    const days = parseInt(timeframe.replace('d', ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await AdminNotification.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unreadCount: {
            $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] }
          }
        }
      }
    ]);

    const totalCount = await AdminNotification.countDocuments({
      userId,
      createdAt: { $gte: startDate }
    });

    const unreadCount = await AdminNotification.countDocuments({
      userId,
      read: false
    });

    return {
      totalCount,
      unreadCount,
      byType: stats,
      timeframe
    };
  }
}

module.exports = AdminNotificationService; 