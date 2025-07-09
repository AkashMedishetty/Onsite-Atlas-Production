const mongoose = require('mongoose');

const ScheduledNotificationSchema = new mongoose.Schema({
  channel: {
    type: String,
    required: true,
    enum: ['email', 'sms', 'whatsapp'],
    index: true
  },
  type: {
    type: String,
    required: true,
    index: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  recipients: [{
    type: String,
    required: true
  }],
  templateData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  scheduledDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  sentAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  error: {
    type: String
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'schedulednotifications'
});

// Indexes for efficient querying
ScheduledNotificationSchema.index({ status: 1, scheduledDate: 1 });
ScheduledNotificationSchema.index({ event: 1, type: 1 });
ScheduledNotificationSchema.index({ channel: 1, status: 1 });

// Virtual for checking if notification is due
ScheduledNotificationSchema.virtual('isDue').get(function() {
  return this.status === 'pending' && this.scheduledDate <= new Date();
});

// Method to mark as sent
ScheduledNotificationSchema.methods.markAsSent = function() {
  this.status = 'sent';
  this.sentAt = new Date();
  return this.save();
};

// Method to mark as failed
ScheduledNotificationSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.error = error;
  this.retryCount += 1;
  return this.save();
};

// Method to cancel notification
ScheduledNotificationSchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this.save();
};

// Static method to find due notifications
ScheduledNotificationSchema.statics.findDue = function() {
  return this.find({
    status: 'pending',
    scheduledDate: { $lte: new Date() }
  });
};

// Static method to cleanup old notifications
ScheduledNotificationSchema.statics.cleanupOld = function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    status: { $in: ['sent', 'failed', 'cancelled'] },
    updatedAt: { $lt: cutoffDate }
  });
};

module.exports = mongoose.model('ScheduledNotification', ScheduledNotificationSchema); 