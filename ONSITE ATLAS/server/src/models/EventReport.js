const mongoose = require('mongoose');

const EventReportSchema = new mongoose.Schema({
  event: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    startDate: Date,
    endDate: Date,
    actualStartTime: Date,
    actualEndTime: Date
  },
  registrations: {
    total: { type: Number, default: 0 },
    confirmed: { type: Number, default: 0 },
    cancelled: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    byCategory: [{
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
      },
      categoryName: String,
      count: Number
    }],
    byPaymentStatus: {
      paid: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      refunded: { type: Number, default: 0 }
    }
  },
  abstracts: {
    total: { type: Number, default: 0 },
    accepted: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    byCategory: [{
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AbstractCategory'
      },
      categoryName: String,
      count: Number
    }]
  },
  finances: {
    totalRevenue: { type: Number, default: 0 },
    totalRefunds: { type: Number, default: 0 },
    netRevenue: { type: Number, default: 0 },
    pendingPayments: { type: Number, default: 0 },
    byCurrency: [{
      currency: String,
      amount: Number
    }]
  },
  engagement: {
    emailsSent: { type: Number, default: 0 },
    smssSent: { type: Number, default: 0 },
    whatsappsSent: { type: Number, default: 0 },
    announcementsSent: { type: Number, default: 0 },
    certificatesGenerated: { type: Number, default: 0 }
  },
  timeline: [{
    status: String,
    timestamp: Date,
    duration: Number, // in minutes
    automated: { type: Boolean, default: false }
  }],
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  generatedBy: {
    type: String,
    default: 'system'
  },
  reportType: {
    type: String,
    enum: ['completion', 'interim', 'final'],
    default: 'completion'
  }
}, {
  timestamps: true,
  collection: 'eventreports'
});

// Indexes for efficient querying
EventReportSchema.index({ 'event.id': 1 });
EventReportSchema.index({ generatedAt: 1 });
EventReportSchema.index({ reportType: 1 });

// Virtual for total duration
EventReportSchema.virtual('totalDuration').get(function() {
  if (!this.event.actualStartTime || !this.event.actualEndTime) return null;
  return Math.round((new Date(this.event.actualEndTime) - new Date(this.event.actualStartTime)) / (1000 * 60)); // in minutes
});

// Virtual for registration rate
EventReportSchema.virtual('registrationRate').get(function() {
  if (this.registrations.total === 0) return 0;
  return ((this.registrations.confirmed / this.registrations.total) * 100).toFixed(2);
});

// Virtual for abstract acceptance rate
EventReportSchema.virtual('abstractAcceptanceRate').get(function() {
  const reviewed = this.abstracts.accepted + this.abstracts.rejected;
  if (reviewed === 0) return 0;
  return ((this.abstracts.accepted / reviewed) * 100).toFixed(2);
});

// Method to generate summary statistics
EventReportSchema.methods.getSummary = function() {
  return {
    event: this.event.name,
    registrations: {
      total: this.registrations.total,
      confirmed: this.registrations.confirmed,
      rate: this.registrationRate + '%'
    },
    abstracts: {
      total: this.abstracts.total,
      accepted: this.abstracts.accepted,
      acceptanceRate: this.abstractAcceptanceRate + '%'
    },
    finances: {
      revenue: this.finances.netRevenue,
      currency: this.finances.byCurrency[0]?.currency || 'INR'
    },
    duration: this.totalDuration ? `${this.totalDuration} minutes` : 'N/A',
    generatedAt: this.generatedAt
  };
};

// Static method to get latest report for event
EventReportSchema.statics.getLatestForEvent = function(eventId) {
  return this.findOne({ 'event.id': eventId }).sort({ generatedAt: -1 });
};

// Static method to get reports for date range
EventReportSchema.statics.getReportsForPeriod = function(startDate, endDate) {
  return this.find({
    generatedAt: { $gte: startDate, $lte: endDate }
  }).sort({ generatedAt: -1 });
};

// Static method to get aggregated statistics
EventReportSchema.statics.getAggregatedStats = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        generatedAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        totalRegistrations: { $sum: '$registrations.total' },
        totalConfirmed: { $sum: '$registrations.confirmed' },
        totalAbstracts: { $sum: '$abstracts.total' },
        totalAccepted: { $sum: '$abstracts.accepted' },
        totalRevenue: { $sum: '$finances.totalRevenue' },
        totalRefunds: { $sum: '$finances.totalRefunds' }
      }
    }
  ]);
};

module.exports = mongoose.model('EventReport', EventReportSchema); 