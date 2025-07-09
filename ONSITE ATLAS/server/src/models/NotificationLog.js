const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  recipientType: {
    type: String,
    enum: ['User', 'Registration', 'Abstract'],
    default: 'Registration'
  },
  channel: {
    type: String,
    required: true,
    enum: ['email', 'sms', 'whatsapp', 'inApp', 'push']
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'bounced', 'unsubscribed'],
    default: 'pending'
  },
  messageId: {
    type: String, // External message ID from service provider
    sparse: true
  },
  subject: String,
  content: String,
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NotificationTemplate'
  },
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NotificationWorkflow'
  },
  priority: {
    type: String,
    enum: ['critical', 'high', 'normal', 'low'],
    default: 'normal'
  },
  scheduledDate: Date,
  sentAt: Date,
  deliveredAt: Date,
  failedAt: Date,
  bouncedAt: Date,
  openedAt: Date,
  clickedAt: Date,
  unsubscribedAt: Date,
  error: String,
  bounceReason: String,
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  // Email specific tracking
  openCount: {
    type: Number,
    default: 0
  },
  clickCount: {
    type: Number,
    default: 0
  },
  clickedUrls: [{
    url: String,
    timestamp: Date
  }],
  trackingUrl: String,
  // SMS specific
  smsDeliveryStatus: String,
  // WhatsApp specific
  whatsappStatus: String,
  // Push notification specific
  pushDeviceTokens: [String],
  pushDeliveryStatus: String,
  // Additional metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    deviceType: String,
    location: String
  },
  // Cost tracking
  cost: {
    amount: Number,
    currency: String,
    provider: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
notificationLogSchema.index({ eventId: 1, channel: 1, status: 1 });
notificationLogSchema.index({ recipientId: 1, type: 1 });
notificationLogSchema.index({ messageId: 1 });
notificationLogSchema.index({ sentAt: 1 });
notificationLogSchema.index({ status: 1, retryCount: 1 });

// Static methods for analytics
notificationLogSchema.statics.getDeliveryStats = async function(eventId, startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        eventId: mongoose.Types.ObjectId(eventId),
        sentAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          channel: '$channel',
          status: '$status'
        },
        count: { $sum: 1 },
        totalCost: { $sum: '$cost.amount' }
      }
    },
    {
      $group: {
        _id: '$_id.channel',
        stats: {
          $push: {
            status: '$_id.status',
            count: '$count',
            totalCost: '$totalCost'
          }
        },
        totalMessages: { $sum: '$count' },
        totalCost: { $sum: '$totalCost' }
      }
    }
  ]);
};

notificationLogSchema.statics.getEngagementStats = async function(eventId, startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        eventId: mongoose.Types.ObjectId(eventId),
        channel: 'email',
        sentAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$type',
        sent: { $sum: 1 },
        opened: { $sum: { $cond: ['$openedAt', 1, 0] } },
        clicked: { $sum: { $cond: ['$clickedAt', 1, 0] } },
        bounced: { $sum: { $cond: [{ $eq: ['$status', 'bounced'] }, 1, 0] } },
        unsubscribed: { $sum: { $cond: [{ $eq: ['$status', 'unsubscribed'] }, 1, 0] } },
        totalOpens: { $sum: '$openCount' },
        totalClicks: { $sum: '$clickCount' }
      }
    },
    {
      $addFields: {
        openRate: { $divide: ['$opened', '$sent'] },
        clickRate: { $divide: ['$clicked', '$sent'] },
        bounceRate: { $divide: ['$bounced', '$sent'] },
        unsubscribeRate: { $divide: ['$unsubscribed', '$sent'] }
      }
    }
  ]);
};

notificationLogSchema.statics.getFailureAnalysis = async function(eventId, startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        eventId: mongoose.Types.ObjectId(eventId),
        status: { $in: ['failed', 'bounced'] },
        sentAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          channel: '$channel',
          error: '$error',
          bounceReason: '$bounceReason'
        },
        count: { $sum: 1 },
        recipients: { $addToSet: '$recipientId' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Instance methods
notificationLogSchema.methods.markAsOpened = function(metadata = {}) {
  this.openedAt = new Date();
  this.openCount += 1;
  this.metadata = { ...this.metadata, ...metadata };
  return this.save();
};

notificationLogSchema.methods.markAsClicked = function(url, metadata = {}) {
  this.clickedAt = new Date();
  this.clickCount += 1;
  this.clickedUrls.push({ url, timestamp: new Date() });
  this.metadata = { ...this.metadata, ...metadata };
  return this.save();
};

notificationLogSchema.methods.markAsBounced = function(reason) {
  this.status = 'bounced';
  this.bouncedAt = new Date();
  this.bounceReason = reason;
  return this.save();
};

notificationLogSchema.methods.markAsUnsubscribed = function() {
  this.status = 'unsubscribed';
  this.unsubscribedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
