const mongoose = require('mongoose');

/**
 * EventDeletionScheduler Schema
 * Implements PurpleHat Advanced Security Protocol for event deletion
 * Events are scheduled for deletion with a 1-hour grace period
 */
const eventDeletionSchedulerSchema = new mongoose.Schema({
  // Event to be deleted
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    unique: true, // Prevent duplicate deletion schedules
    index: true
  },
  
  // Event metadata (cached for reference after deletion)
  eventMetadata: {
    name: { type: String, required: true },
    startDate: Date,
    endDate: Date,
    venue: {
      name: String,
      address: String,
      city: String,
      country: String
    },
    registrationCount: { type: Number, default: 0 },
    category: String,
    description: String
  },
  
  // Deletion scheduling
  scheduledAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  // When deletion will actually execute (1 hour from scheduled)
  executeAt: {
    type: Date,
    index: true
  },
  
  // Current status of deletion
  status: {
    type: String,
    enum: ['scheduled', 'cancelled', 'executing', 'completed', 'failed'],
    default: 'scheduled',
    required: true,
    index: true
  },
  
  // User who initiated the deletion
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Initiator details (cached)
  initiatorDetails: {
    name: String,
    email: String,
    role: String
  },
  
  // User who cancelled (if applicable)
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Cancellation details
  cancellationReason: String,
  cancelledAt: Date,
  
  // Execution details
  executionStartedAt: Date,
  executionCompletedAt: Date,
  executionFailedAt: Date,
  
  // Error details if execution failed
  executionError: {
    message: String,
    stack: String,
    timestamp: Date
  },
  
  // Deletion statistics (populated during execution)
  deletionStats: {
    totalCollections: { type: Number, default: 0 },
    totalRecords: { type: Number, default: 0 },
    collectionsDeleted: [String],
    recordCounts: {
      type: Map,
      of: Number
    },
    startTime: Date,
    endTime: Date,
    duration: Number // in milliseconds
  },
  
  // Security validation
  securityChecks: {
    hasActiveRegistrations: { type: Boolean, default: false },
    hasRecentPayments: { type: Boolean, default: false },
    hasOngoingEvent: { type: Boolean, default: false },
    requiresAdminApproval: { type: Boolean, default: false },
    checksPerformedAt: Date
  },
  
  // Grace period configuration
  gracePeriodHours: {
    type: Number,
    default: 1,
    min: 0.1, // Minimum 6 minutes for testing
    max: 168   // Maximum 1 week
  },
  
  // Notifications sent
  notificationsSent: {
    scheduled: { type: Boolean, default: false },
    reminder30min: { type: Boolean, default: false },
    reminder5min: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    cancelled: { type: Boolean, default: false }
  },
  
  // Additional metadata
  userAgent: String,
  ipAddress: String,
  sessionId: String,
  
  // Soft delete flag
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for performance
eventDeletionSchedulerSchema.index({ executeAt: 1, status: 1 });
eventDeletionSchedulerSchema.index({ scheduledAt: 1 });
eventDeletionSchedulerSchema.index({ initiatedBy: 1 });
eventDeletionSchedulerSchema.index({ status: 1, executeAt: 1 });

// Pre-save middleware to set executeAt based on grace period
eventDeletionSchedulerSchema.pre('save', function(next) {
  if (this.isNew && !this.executeAt) {
    const scheduledAt = this.scheduledAt || new Date();
    const executeAt = new Date(scheduledAt);
    executeAt.setTime(executeAt.getTime() + (this.gracePeriodHours * 60 * 60 * 1000));
    this.executeAt = executeAt;
  }
  next();
});

// Instance methods
eventDeletionSchedulerSchema.methods.cancel = function(cancelledBy, reason) {
  this.status = 'cancelled';
  this.cancelledBy = cancelledBy;
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  return this.save();
};

eventDeletionSchedulerSchema.methods.getRemainingTime = function() {
  const now = new Date();
  const remaining = this.executeAt.getTime() - now.getTime();
  return Math.max(0, remaining);
};

eventDeletionSchedulerSchema.methods.getRemainingTimeFormatted = function() {
  const remaining = this.getRemainingTime();
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

eventDeletionSchedulerSchema.methods.isExpired = function() {
  return new Date() >= this.executeAt;
};

eventDeletionSchedulerSchema.methods.canBeCancelled = function() {
  return this.status === 'scheduled' && !this.isExpired();
};

// Static methods
eventDeletionSchedulerSchema.statics.findPendingDeletions = function() {
  return this.find({
    status: 'scheduled',
    executeAt: { $lte: new Date() },
    isDeleted: false
  }).populate('event initiatedBy');
};

eventDeletionSchedulerSchema.statics.findUpcomingDeletions = function(withinMinutes = 30) {
  const cutoff = new Date();
  cutoff.setMinutes(cutoff.getMinutes() + withinMinutes);
  
  return this.find({
    status: 'scheduled',
    executeAt: { $lte: cutoff, $gt: new Date() },
    isDeleted: false
  }).populate('event initiatedBy');
};

eventDeletionSchedulerSchema.statics.cleanupOldRecords = function(olderThanDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);
  
  return this.deleteMany({
    $or: [
      { status: 'completed', executionCompletedAt: { $lt: cutoff } },
      { status: 'cancelled', cancelledAt: { $lt: cutoff } },
      { status: 'failed', executionFailedAt: { $lt: cutoff } }
    ]
  });
};

const EventDeletionScheduler = mongoose.model('EventDeletionScheduler', eventDeletionSchedulerSchema);

module.exports = EventDeletionScheduler; 