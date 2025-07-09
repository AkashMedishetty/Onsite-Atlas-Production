const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Some events might not have a user context
  },
  event: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    enum: ['security', 'user_action', 'system', 'admin', 'payment', 'registration', 'abstract', 'notification'],
    index: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info'
  },
  description: {
    type: String,
    required: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  ip: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false
  },
  sessionId: {
    type: String,
    required: false
  },
  outcome: {
    type: String,
    enum: ['success', 'failure', 'pending', 'cancelled'],
    default: 'success'
  },
  resourceId: {
    type: String,
    required: false // ID of the resource being acted upon
  },
  resourceType: {
    type: String,
    required: false // Type of resource (event, registration, abstract, etc.)
  },
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],
  correlationId: {
    type: String,
    required: false // For tracking related events
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ event: 1, timestamp: -1 });
auditLogSchema.index({ category: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ correlationId: 1 });
auditLogSchema.index({ ip: 1, timestamp: -1 });
auditLogSchema.index({ resourceId: 1, resourceType: 1 });

// Compound indexes for common queries
auditLogSchema.index({ userId: 1, event: 1, timestamp: -1 });
auditLogSchema.index({ category: 1, severity: 1, timestamp: -1 });

// Static methods
auditLogSchema.statics.logEvent = async function(eventData) {
  try {
    const log = new this(eventData);
    await log.save();
    return log;
  } catch (error) {
    console.error('Failed to log audit event:', error);
    throw error;
  }
};

auditLogSchema.statics.getRecentActivity = async function(userId, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return await this.find({
    userId,
    timestamp: { $gte: since }
  }).sort({ timestamp: -1 });
};

auditLogSchema.statics.getSecurityEvents = async function(filters = {}) {
  const query = { category: 'security', ...filters };
  return await this.find(query)
    .sort({ timestamp: -1 })
    .populate('userId', 'email firstName lastName');
};

auditLogSchema.statics.getFailedAttempts = async function(userId, event, hours = 1) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return await this.find({
    userId,
    event,
    outcome: 'failure',
    timestamp: { $gte: since }
  }).sort({ timestamp: -1 });
};

auditLogSchema.statics.getActivityByIP = async function(ip, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return await this.find({
    ip,
    timestamp: { $gte: since }
  }).sort({ timestamp: -1 });
};

auditLogSchema.statics.getResourceActivity = async function(resourceId, resourceType) {
  return await this.find({
    resourceId,
    resourceType
  }).sort({ timestamp: -1 });
};

auditLogSchema.statics.getCorrelatedEvents = async function(correlationId) {
  return await this.find({
    correlationId
  }).sort({ timestamp: 1 });
};

// Instance methods
auditLogSchema.methods.addChange = function(field, oldValue, newValue) {
  this.changes.push({
    field,
    oldValue,
    newValue
  });
};

auditLogSchema.methods.setCorrelationId = function(correlationId) {
  this.correlationId = correlationId;
};

// Virtual for human-readable timestamp
auditLogSchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Virtual for duration calculation (if needed)
auditLogSchema.virtual('duration').get(function() {
  if (this.metadata && this.metadata.startTime && this.metadata.endTime) {
    return new Date(this.metadata.endTime) - new Date(this.metadata.startTime);
  }
  return null;
});

// Pre-save middleware
auditLogSchema.pre('save', function(next) {
  // Sanitize sensitive data
  if (this.metadata && this.metadata.password) {
    this.metadata.password = '[REDACTED]';
  }
  
  if (this.metadata && this.metadata.token) {
    this.metadata.token = '[REDACTED]';
  }
  
  // Set correlation ID if not provided
  if (!this.correlationId && this.metadata && this.metadata.correlationId) {
    this.correlationId = this.metadata.correlationId;
  }
  
  next();
});

// TTL index for automatic cleanup (optional - adjust based on retention policy)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }); // 1 year

module.exports = mongoose.model('AuditLog', auditLogSchema);
