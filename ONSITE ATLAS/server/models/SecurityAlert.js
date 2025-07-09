const mongoose = require('mongoose');

const securityAlertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return 'ALERT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
  },
  type: {
    type: String,
    required: true,
    enum: [
      'suspicious_login',
      'multiple_failed_attempts',
      'brute_force_attack',
      'unusual_activity',
      'data_breach_attempt',
      'privilege_escalation',
      'suspicious_payment',
      'fraud_attempt',
      'ddos_attack',
      'malware_detection',
      'unauthorized_access',
      'account_takeover',
      'sql_injection',
      'xss_attempt',
      'csrf_attack',
      'rate_limit_exceeded',
      'geo_anomaly',
      'session_hijacking',
      'phishing_attempt',
      'other'
    ],
    index: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    default: 'medium',
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'investigating', 'resolved', 'false_positive', 'suppressed'],
    default: 'active',
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  targetResource: {
    type: String,
    required: false
  },
  targetResourceType: {
    type: String,
    required: false
  },
  sourceIP: {
    type: String,
    required: false,
    index: true
  },
  userAgent: {
    type: String,
    required: false
  },
  geoLocation: {
    country: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  detectionMethod: {
    type: String,
    enum: ['automated', 'manual', 'external_tool', 'user_report'],
    default: 'automated'
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  evidence: [{
    type: String,
    description: String,
    timestamp: Date,
    auditLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuditLog'
    }
  }],
  actions: [{
    action: {
      type: String,
      enum: ['block_ip', 'lock_account', 'require_2fa', 'notify_admin', 'escalate', 'monitor', 'quarantine', 'other']
    },
    description: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    automated: {
      type: Boolean,
      default: false
    }
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  firstDetected: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  resolvedAt: {
    type: Date,
    required: false
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  resolutionNotes: {
    type: String,
    required: false
  },
  notificationsSent: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'push', 'webhook', 'slack']
    },
    recipient: String,
    timestamp: Date,
    status: {
      type: String,
      enum: ['sent', 'failed', 'pending']
    }
  }],
  suppressUntil: {
    type: Date,
    required: false
  },
  correlationId: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
securityAlertSchema.index({ type: 1, severity: 1, status: 1 });
securityAlertSchema.index({ userId: 1, status: 1 });
securityAlertSchema.index({ sourceIP: 1, firstDetected: -1 });
securityAlertSchema.index({ status: 1, firstDetected: -1 });
securityAlertSchema.index({ severity: 1, firstDetected: -1 });
securityAlertSchema.index({ assignedTo: 1, status: 1 });
securityAlertSchema.index({ correlationId: 1 });
securityAlertSchema.index({ tags: 1 });

// Compound indexes
securityAlertSchema.index({ type: 1, sourceIP: 1, firstDetected: -1 });
securityAlertSchema.index({ status: 1, severity: 1, firstDetected: -1 });

// Static methods
securityAlertSchema.statics.createAlert = async function(alertData) {
  try {
    const alert = new this(alertData);
    await alert.save();
    
    // Auto-assign based on severity and type
    if (alert.severity === 'critical' || alert.severity === 'high') {
      await alert.autoAssign();
    }
    
    return alert;
  } catch (error) {
    console.error('Failed to create security alert:', error);
    throw error;
  }
};

securityAlertSchema.statics.getActiveAlerts = async function(filters = {}) {
  const query = { status: 'active', ...filters };
  return await this.find(query)
    .sort({ severity: -1, firstDetected: -1 })
    .populate('userId', 'email firstName lastName')
    .populate('assignedTo', 'email firstName lastName');
};

securityAlertSchema.statics.getCriticalAlerts = async function() {
  return await this.find({
    severity: 'critical',
    status: { $in: ['active', 'investigating'] }
  }).sort({ firstDetected: -1 });
};

securityAlertSchema.statics.getAlertsByIP = async function(ip, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return await this.find({
    sourceIP: ip,
    firstDetected: { $gte: since }
  }).sort({ firstDetected: -1 });
};

securityAlertSchema.statics.getAlertsByUser = async function(userId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return await this.find({
    userId,
    firstDetected: { $gte: since }
  }).sort({ firstDetected: -1 });
};

securityAlertSchema.statics.getAlertTrends = async function(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return await this.aggregate([
    { $match: { firstDetected: { $gte: since } } },
    {
      $group: {
        _id: {
          type: '$type',
          severity: '$severity',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$firstDetected' } }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': -1 } }
  ]);
};

securityAlertSchema.statics.getUnassignedAlerts = async function() {
  return await this.find({
    assignedTo: null,
    status: { $in: ['active', 'investigating'] }
  }).sort({ severity: -1, firstDetected: -1 });
};

// Instance methods
securityAlertSchema.methods.addEvidence = function(evidence) {
  this.evidence.push({
    ...evidence,
    timestamp: new Date()
  });
  this.lastActivity = new Date();
};

securityAlertSchema.methods.addAction = function(action, userId = null, automated = false) {
  this.actions.push({
    ...action,
    timestamp: new Date(),
    performedBy: userId,
    automated
  });
  this.lastActivity = new Date();
};

securityAlertSchema.methods.assignTo = function(userId) {
  this.assignedTo = userId;
  this.addAction({
    action: 'other',
    description: 'Alert assigned to security team member'
  }, userId);
};

securityAlertSchema.methods.resolve = function(userId, resolutionNotes) {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  this.resolvedBy = userId;
  this.resolutionNotes = resolutionNotes;
  this.addAction({
    action: 'other',
    description: 'Alert resolved'
  }, userId);
};

securityAlertSchema.methods.escalate = function(userId) {
  if (this.severity === 'low') this.severity = 'medium';
  else if (this.severity === 'medium') this.severity = 'high';
  else if (this.severity === 'high') this.severity = 'critical';
  
  this.addAction({
    action: 'escalate',
    description: 'Alert escalated due to continued activity'
  }, userId);
};

securityAlertSchema.methods.suppress = function(hours = 24) {
  this.status = 'suppressed';
  this.suppressUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
};

securityAlertSchema.methods.autoAssign = async function() {
  // Simple auto-assignment logic - could be enhanced with load balancing
  const AdminUser = mongoose.model('User');
  const adminUser = await AdminUser.findOne({ 
    role: 'admin',
    isActive: true 
  }).sort({ lastLogin: -1 });
  
  if (adminUser) {
    this.assignedTo = adminUser._id;
    await this.save();
  }
};

securityAlertSchema.methods.calculateRiskScore = function() {
  let score = 0;
  
  // Base score by severity
  switch (this.severity) {
    case 'low': score += 25; break;
    case 'medium': score += 50; break;
    case 'high': score += 75; break;
    case 'critical': score += 100; break;
  }
  
  // Adjust by type
  const highRiskTypes = ['brute_force_attack', 'data_breach_attempt', 'account_takeover'];
  if (highRiskTypes.includes(this.type)) {
    score = Math.min(100, score + 20);
  }
  
  // Adjust by evidence count
  score = Math.min(100, score + (this.evidence.length * 5));
  
  this.riskScore = score;
};

// Pre-save middleware
securityAlertSchema.pre('save', function(next) {
  // Calculate risk score
  this.calculateRiskScore();
  
  // Update last activity
  this.lastActivity = new Date();
  
  // Check if should be auto-resolved
  if (this.suppressUntil && this.suppressUntil < new Date()) {
    this.status = 'resolved';
    this.resolvedAt = new Date();
    this.resolutionNotes = 'Auto-resolved after suppression period';
  }
  
  next();
});

// Virtual for duration
securityAlertSchema.virtual('duration').get(function() {
  const endTime = this.resolvedAt || new Date();
  return endTime - this.firstDetected;
});

// Virtual for formatted duration
securityAlertSchema.virtual('formattedDuration').get(function() {
  const duration = this.duration;
  const hours = Math.floor(duration / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
});

module.exports = mongoose.model('SecurityAlert', securityAlertSchema);
