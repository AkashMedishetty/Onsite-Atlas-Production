const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'registration',
      'payment', 
      'abstract',
      'alert',
      'success',
      'info',
      'system',
      'event'
    ],
    default: 'info'
  },
  priority: {
    type: String,
    enum: ['critical', 'high', 'normal', 'low'],
    default: 'normal'
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  registrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration'
  },
  abstractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Abstract'
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  // Action data for notification interactions
  actionUrl: {
    type: String
  },
  actionType: {
    type: String,
    enum: ['navigate', 'external', 'modal', 'none'],
    default: 'none'
  },
  // Additional metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  // Auto-expire notifications after certain time
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  },
  // Delivery tracking
  deliveryStatus: {
    type: String,
    enum: ['pending', 'delivered', 'failed'],
    default: 'pending'
  },
  deliveredAt: {
    type: Date
  },
  // For grouping related notifications
  groupId: {
    type: String
  },
  // For real-time updates
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  suppressReservedKeysWarning: true
});

// Indexes for performance
adminNotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
adminNotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
adminNotificationSchema.index({ userId: 1, priority: 1, createdAt: -1 });
adminNotificationSchema.index({ expiresAt: 1 });
adminNotificationSchema.index({ groupId: 1 });

// Virtual for time ago
adminNotificationSchema.virtual('timeAgo').get(function() {
  if (!this.createdAt) return 'Unknown';
  
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
});

// Static methods for notification management
adminNotificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  await notification.save();
  
  // Emit real-time notification if WebSocket is available
  const { getIO } = require('../websocket');
  const io = getIO();
  if (io) {
    io.to(`user_${data.userId}`).emit('new_notification', notification);
  }
  
  return notification;
};

adminNotificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ userId, read: false });
};

adminNotificationSchema.statics.markAllAsRead = async function(userId) {
  const result = await this.updateMany(
    { userId, read: false },
    { read: true, readAt: new Date() }
  );
  
  // Emit real-time update
  const { getIO } = require('../websocket');
  const io = getIO();
  if (io) {
    io.to(`user_${userId}`).emit('notifications_marked_read', { count: result.modifiedCount });
  }
  
  return result;
};

adminNotificationSchema.statics.cleanupExpired = async function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Instance methods
adminNotificationSchema.methods.markAsRead = async function() {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    await this.save();
    
      // Emit real-time update
  const { getIO } = require('../websocket');
  const io = getIO();
  if (io) {
    io.to(`user_${this.userId}`).emit('notification_read', { id: this._id });
    }
  }
  return this;
};

adminNotificationSchema.methods.markAsDelivered = async function() {
  this.deliveryStatus = 'delivered';
  this.deliveredAt = new Date();
  await this.save();
  return this;
};

// Pre-save middleware
adminNotificationSchema.pre('save', function(next) {
  if (this.isNew) {
    // Set default expiry for non-critical notifications (30 days)
    if (!this.expiresAt && this.priority !== 'critical') {
      this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    
    // Auto-generate groupId for related notifications
    if (!this.groupId && (this.registrationId || this.eventId || this.paymentId)) {
      this.groupId = `${this.type}_${this.registrationId || this.eventId || this.paymentId}`;
    }
  }
  next();
});

const AdminNotification = mongoose.model('AdminNotification', adminNotificationSchema);

module.exports = AdminNotification; 