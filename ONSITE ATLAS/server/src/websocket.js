const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const AdminNotification = require('./models/AdminNotification');

let io;

const initializeWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.user = user;
      
      console.log(`🔗 WebSocket: User ${user.email} connected`);
      next();
    } catch (error) {
      console.error('❌ WebSocket Auth Error:', error.message);
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ WebSocket Connected: User ${socket.userId}`);

    // Join user-specific room for targeted notifications
    socket.join(`user_${socket.userId}`);

    // Join role-specific rooms if needed
    if (socket.userRole === 'admin' || socket.userRole === 'super_admin') {
      socket.join('admin_room');
    }

    // Handle client requesting notification sync
    socket.on('sync_notifications', async () => {
      try {
        console.log(`🔄 Syncing notifications for user ${socket.userId}`);
        
        // Get recent unread notifications
        const notifications = await AdminNotification.find({
          userId: socket.userId,
          read: false
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

        // Get unread count
        const unreadCount = await AdminNotification.getUnreadCount(socket.userId);

        socket.emit('notifications_synced', {
          notifications,
          unreadCount,
          timestamp: new Date()
        });

        console.log(`📊 Sent ${notifications.length} notifications to user ${socket.userId}`);
      } catch (error) {
        console.error('❌ Error syncing notifications:', error);
        socket.emit('sync_error', { message: 'Failed to sync notifications' });
      }
    });

    // Handle marking notification as read
    socket.on('mark_notification_read', async (data) => {
      try {
        const { notificationId } = data;
        
        const notification = await AdminNotification.findOne({
          _id: notificationId,
          userId: socket.userId
        });

        if (notification) {
          await notification.markAsRead();
          
          // Send updated unread count
          const unreadCount = await AdminNotification.getUnreadCount(socket.userId);
          socket.emit('unread_count_updated', { count: unreadCount });
          
          console.log(`✅ Marked notification ${notificationId} as read for user ${socket.userId}`);
        }
      } catch (error) {
        console.error('❌ Error marking notification as read:', error);
        socket.emit('mark_read_error', { message: 'Failed to mark notification as read' });
      }
    });

    // Handle marking all notifications as read
    socket.on('mark_all_read', async () => {
      try {
        await AdminNotification.markAllAsRead(socket.userId);
        
        socket.emit('all_notifications_read', { timestamp: new Date() });
        socket.emit('unread_count_updated', { count: 0 });
        
        console.log(`✅ Marked all notifications as read for user ${socket.userId}`);
      } catch (error) {
        console.error('❌ Error marking all notifications as read:', error);
        socket.emit('mark_all_read_error', { message: 'Failed to mark all notifications as read' });
      }
    });

    // Handle client requesting specific notifications
    socket.on('get_notifications', async (data) => {
      try {
        const { page = 1, limit = 20, type, read } = data;
        const skip = (page - 1) * limit;

        const query = { userId: socket.userId };
        if (type) query.type = type;
        if (read !== undefined) query.read = read;

        const notifications = await AdminNotification.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('eventId', 'name')
          .populate('registrationId', 'registrationId personalInfo')
          .lean();

        const total = await AdminNotification.countDocuments(query);

        socket.emit('notifications_received', {
          notifications,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        });
      } catch (error) {
        console.error('❌ Error getting notifications:', error);
        socket.emit('get_notifications_error', { message: 'Failed to get notifications' });
      }
    });

    // Handle notification deletion
    socket.on('delete_notification', async (data) => {
      try {
        const { notificationId } = data;
        
        await AdminNotification.findOneAndDelete({
          _id: notificationId,
          userId: socket.userId
        });

        const unreadCount = await AdminNotification.getUnreadCount(socket.userId);
        socket.emit('notification_deleted', { id: notificationId });
        socket.emit('unread_count_updated', { count: unreadCount });
        
        console.log(`🗑️ Deleted notification ${notificationId} for user ${socket.userId}`);
      } catch (error) {
        console.error('❌ Error deleting notification:', error);
        socket.emit('delete_notification_error', { message: 'Failed to delete notification' });
      }
    });

    // Handle connection cleanup
    socket.on('disconnect', (reason) => {
      console.log(`❌ WebSocket Disconnected: User ${socket.userId}, Reason: ${reason}`);
    });

    // Send initial notification count on connection
    AdminNotification.getUnreadCount(socket.userId)
      .then(count => {
        socket.emit('unread_count_updated', { count });
        console.log(`📊 Initial unread count for user ${socket.userId}: ${count}`);
      })
      .catch(error => {
        console.error('❌ Error getting initial unread count:', error);
      });
  });

  // Cleanup expired notifications periodically
  setInterval(async () => {
    try {
      const deleted = await AdminNotification.cleanupExpired();
      if (deleted.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deleted.deletedCount} expired notifications`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up expired notifications:', error);
    }
  }, 24 * 60 * 60 * 1000); // Run daily

  console.log('🚀 WebSocket server initialized');
  return io;
};

// Utility functions for sending notifications
const sendNotificationToUser = async (userId, notification) => {
  if (io) {
    const unreadCount = await AdminNotification.getUnreadCount(userId);
    io.to(`user_${userId}`).emit('new_notification', notification);
    io.to(`user_${userId}`).emit('unread_count_updated', { count: unreadCount });
    console.log(`📢 Sent notification to user ${userId}`);
  }
};

const sendNotificationToAdmins = (notification) => {
  if (io) {
    io.to('admin_room').emit('admin_notification', notification);
    console.log('📢 Sent notification to all admins');
  }
};

const broadcastSystemNotification = (notification) => {
  if (io) {
    io.emit('system_notification', notification);
    console.log('📢 Broadcasted system notification');
  }
};

const getConnectedUsersCount = () => {
  return io ? io.engine.clientsCount : 0;
};

const getUsersInRoom = (room) => {
  return io ? io.sockets.adapter.rooms.get(room)?.size || 0 : 0;
};

// Export the module
module.exports = {
  initializeWebSocket,
  sendNotificationToUser,
  sendNotificationToAdmins,
  broadcastSystemNotification,
  getConnectedUsersCount,
  getUsersInRoom,
  getIO: () => io
}; 