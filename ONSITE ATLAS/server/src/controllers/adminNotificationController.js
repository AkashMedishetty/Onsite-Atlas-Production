const AdminNotification = require('../models/AdminNotification');
const AdminNotificationService = require('../services/adminNotificationService');
const ApiError = require('../utils/ApiError');
const { sendSuccessResponse, sendErrorResponse } = require('../utils/responseUtils');

// Get all notifications for a user with pagination and filtering
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 20,
      type,
      read,
      priority,
      startDate,
      endDate,
      search
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { userId };

    // Apply filters
    if (type) query.type = type;
    if (read !== undefined) query.read = read === 'true';
    if (priority) query.priority = priority;
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const notifications = await AdminNotification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('eventId', 'name startDate endDate')
      .populate('registrationId', 'registrationId personalInfo')
      .populate('abstractId', 'title authors')
      .lean();

    const total = await AdminNotification.countDocuments(query);
    const unreadCount = await AdminNotification.getUnreadCount(userId);

    const response = {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    };

    sendSuccessResponse(res, response, 'Notifications retrieved successfully');
  } catch (error) {
    console.error('❌ Error getting notifications:', error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get unread notification count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const count = await AdminNotification.getUnreadCount(userId);
    
    sendSuccessResponse(res, { count }, 'Unread count retrieved successfully');
  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Mark a notification as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await AdminNotification.findOne({ _id: id, userId });
    
    if (!notification) {
      return sendErrorResponse(res, 'Notification not found', 404);
    }

    await notification.markAsRead();
    const unreadCount = await AdminNotification.getUnreadCount(userId);

    sendSuccessResponse(res, { notification, unreadCount }, 'Notification marked as read');
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const result = await AdminNotification.markAllAsRead(userId);
    
    sendSuccessResponse(res, { 
      modifiedCount: result.modifiedCount,
      unreadCount: 0 
    }, 'All notifications marked as read');
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Delete a notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await AdminNotification.findOneAndDelete({ _id: id, userId });
    
    if (!notification) {
      return sendErrorResponse(res, 'Notification not found', 404);
    }

    const unreadCount = await AdminNotification.getUnreadCount(userId);

    sendSuccessResponse(res, { unreadCount }, 'Notification deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Delete multiple notifications
const deleteMultiple = async (req, res) => {
  try {
    const { ids } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(ids) || ids.length === 0) {
      return sendErrorResponse(res, 'Invalid notification IDs provided', 400);
    }

    const result = await AdminNotification.deleteMany({
      _id: { $in: ids },
      userId
    });

    const unreadCount = await AdminNotification.getUnreadCount(userId);

    sendSuccessResponse(res, { 
      deletedCount: result.deletedCount,
      unreadCount 
    }, 'Notifications deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting multiple notifications:', error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get notification statistics
const getStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeframe = '7d' } = req.query;

    const stats = await AdminNotificationService.getNotificationStats(userId, timeframe);
    
    sendSuccessResponse(res, stats, 'Notification statistics retrieved successfully');
  } catch (error) {
    console.error('❌ Error getting notification stats:', error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Create a test notification (for development/testing)
const createTestNotification = async (req, res) => {
  try {
    // Only allow in development or for super admins
    if (process.env.NODE_ENV === 'production' && req.user.role !== 'super_admin') {
      return sendErrorResponse(res, 'Not authorized to create test notifications', 403);
    }

    const userId = req.user._id;
    const {
      title = 'Test Notification',
      message = 'This is a test notification to verify the system is working.',
      type = 'info',
      priority = 'normal'
    } = req.body;

    const notification = await AdminNotificationService.createNotification({
      title,
      message,
      type,
      priority,
      userId,
      actionType: 'none'
    });

    sendSuccessResponse(res, notification, 'Test notification created successfully');
  } catch (error) {
    console.error('❌ Error creating test notification:', error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get notifications by type
const getByType = async (req, res) => {
  try {
    const { type } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;
    
    const notifications = await AdminNotification.find({ userId, type })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('eventId', 'name startDate endDate')
      .populate('registrationId', 'registrationId personalInfo')
      .lean();

    const total = await AdminNotification.countDocuments({ userId, type });

    const response = {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      type
    };

    sendSuccessResponse(res, response, `${type} notifications retrieved successfully`);
  } catch (error) {
    console.error('❌ Error getting notifications by type:', error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Update notification preferences (future feature)
const updatePreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const preferences = req.body;

    // This could be extended to save user notification preferences
    // For now, just return success
    sendSuccessResponse(res, { preferences }, 'Notification preferences updated successfully');
  } catch (error) {
    console.error('❌ Error updating notification preferences:', error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Export statistics for admin analysis
const exportNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { format = 'json', startDate, endDate, type } = req.query;

    const query = { userId };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (type) query.type = type;

    const notifications = await AdminNotification.find(query)
      .sort({ createdAt: -1 })
      .populate('eventId', 'name startDate endDate')
      .populate('registrationId', 'registrationId personalInfo')
      .lean();

    if (format === 'csv') {
      // Convert to CSV format
      const csv = notifications.map(n => ({
        title: n.title,
        message: n.message,
        type: n.type,
        priority: n.priority,
        read: n.read,
        createdAt: n.createdAt,
        eventName: n.eventId?.name || '',
        registrationId: n.registrationId?.registrationId || ''
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=notifications.csv');
      
      // Simple CSV conversion (in production, use a proper CSV library)
      const csvString = [
        Object.keys(csv[0]).join(','),
        ...csv.map(row => Object.values(row).join(','))
      ].join('\n');
      
      res.send(csvString);
    } else {
      sendSuccessResponse(res, { notifications, count: notifications.length }, 'Notifications exported successfully');
    }
  } catch (error) {
    console.error('❌ Error exporting notifications:', error);
    sendErrorResponse(res, error.message, 500);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultiple,
  getStats,
  createTestNotification,
  getByType,
  updatePreferences,
  exportNotifications
}; 