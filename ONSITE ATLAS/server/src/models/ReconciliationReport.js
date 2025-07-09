const mongoose = require('mongoose');

const ReconciliationReportSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true
  },
  summary: {
    totalEvents: { type: Number, default: 0 },
    totalPayments: { type: Number, default: 0 },
    matched: { type: Number, default: 0 },
    mismatched: { type: Number, default: 0 },
    missing: { type: Number, default: 0 },
    errors: { type: Number, default: 0 }
  },
  events: [{
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true
    },
    eventName: String,
    provider: String,
    dateRange: {
      start: Date,
      end: Date
    },
    comparison: {
      matched: [mongoose.Schema.Types.Mixed],
      mismatched: [mongoose.Schema.Types.Mixed],
      missing: [mongoose.Schema.Types.Mixed],
      extra: [mongoose.Schema.Types.Mixed]
    },
    summary: {
      totalPayments: Number,
      gatewayPayments: Number,
      matched: Number,
      mismatched: Number,
      missing: Number,
      errors: Number
    }
  }],
  generatedAt: {
    type: Date,
    default: Date.now
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'reconciliationreports'
});

// Indexes for efficient querying
ReconciliationReportSchema.index({ date: 1 });
ReconciliationReportSchema.index({ 'events.eventId': 1 });
ReconciliationReportSchema.index({ generatedAt: 1 });

// Virtual for match rate calculation
ReconciliationReportSchema.virtual('matchRate').get(function() {
  if (this.summary.totalPayments === 0) return 100;
  return ((this.summary.matched / this.summary.totalPayments) * 100).toFixed(2);
});

// Method to get discrepancy rate
ReconciliationReportSchema.methods.getDiscrepancyRate = function() {
  if (this.summary.totalPayments === 0) return 0;
  const discrepancies = this.summary.mismatched + this.summary.missing;
  return ((discrepancies / this.summary.totalPayments) * 100).toFixed(2);
};

// Static method to get latest report for date
ReconciliationReportSchema.statics.getLatestForDate = function(date) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  
  return this.findOne({
    date: { $gte: startDate, $lte: endDate }
  }).sort({ generatedAt: -1 });
};

// Static method to get reports for date range
ReconciliationReportSchema.statics.getReportsForRange = function(startDate, endDate) {
  return this.find({
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: 1 });
};

// Static method to cleanup old reports
ReconciliationReportSchema.statics.cleanupOld = function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    date: { $lt: cutoffDate }
  });
};

module.exports = mongoose.model('ReconciliationReport', ReconciliationReportSchema); 