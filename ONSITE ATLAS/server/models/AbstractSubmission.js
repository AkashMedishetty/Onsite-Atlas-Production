const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AbstractSubmissionSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 255
  },
  
  abstract: {
    type: String,
    required: true,
    maxLength: 5000
  },
  
  keywords: [{
    type: String,
    trim: true,
    maxLength: 50
  }],
  
  category: {
    type: String,
    required: true,
    enum: ['research', 'case_study', 'poster', 'workshop', 'keynote', 'panel']
  },
  
  presentationType: {
    type: String,
    required: true,
    enum: ['oral', 'poster', 'virtual', 'hybrid']
  },
  
  // Submission details
  submissionId: {
    type: String,
    unique: true,
    required: true
  },
  
  eventId: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Authors and affiliations
  authors: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    affiliation: {
      type: String,
      required: true
    },
    isCorresponding: {
      type: Boolean,
      default: false
    },
    order: {
      type: Number,
      required: true
    }
  }],
  
  // Submission status and workflow
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'revision_requested', 'revised', 'accepted', 'rejected', 'withdrawn'],
    default: 'draft'
  },
  
  // Version control
  version: {
    type: Number,
    default: 1
  },
  
  revisionHistory: [{
    version: Number,
    submittedAt: Date,
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    changes: String,
    reviewerComments: String,
    files: [{
      filename: String,
      originalName: String,
      size: Number,
      uploadedAt: Date
    }]
  }],
  
  // Review process
  reviewAssignments: [{
    type: Schema.Types.ObjectId,
    ref: 'AbstractReview'
  }],
  
  reviewRound: {
    type: Number,
    default: 1
  },
  
  finalDecision: {
    decision: {
      type: String,
      enum: ['accepted', 'rejected', 'revision_required', 'pending']
    },
    decidedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    decidedAt: Date,
    comments: String,
    overrideReason: String
  },
  
  // Blind review support
  isBlindReview: {
    type: Boolean,
    default: false
  },
  
  anonymizedTitle: String,
  anonymizedAbstract: String,
  
  // File attachments
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    uploadedAt: Date,
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Presentation details (if accepted)
  presentationDetails: {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session'
    },
    scheduledAt: Date,
    duration: Number, // in minutes
    room: String,
    equipment: [String],
    specialRequirements: String
  },
  
  // Compliance and requirements
  ethicsApproval: {
    required: Boolean,
    provided: Boolean,
    approvalNumber: String,
    expiryDate: Date
  },
  
  conflictOfInterest: {
    declared: Boolean,
    details: String
  },
  
  // Submission deadlines
  submissionDeadline: Date,
  revisionDeadline: Date,
  
  // Workflow timestamps
  submittedAt: Date,
  lastModifiedAt: Date,
  reviewStartedAt: Date,
  reviewCompletedAt: Date,
  
  // Communication tracking
  notifications: [{
    type: {
      type: String,
      enum: ['submission_confirmation', 'review_started', 'revision_requested', 'decision_made', 'reminder']
    },
    sentAt: Date,
    channel: String,
    status: String
  }],
  
  // Metrics and analytics
  metrics: {
    viewCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    lastViewedAt: Date,
    timeSpentInReview: Number // in hours
  },
  
  // Search and indexing
  searchableText: String,
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  deletedAt: Date,
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
AbstractSubmissionSchema.index({ submissionId: 1 });
AbstractSubmissionSchema.index({ eventId: 1, status: 1 });
AbstractSubmissionSchema.index({ submittedBy: 1 });
AbstractSubmissionSchema.index({ status: 1, submittedAt: 1 });
AbstractSubmissionSchema.index({ 'authors.email': 1 });
AbstractSubmissionSchema.index({ category: 1, presentationType: 1 });
AbstractSubmissionSchema.index({ searchableText: 'text' });

// Virtual fields
AbstractSubmissionSchema.virtual('totalReviews').get(function() {
  return this.reviewAssignments ? this.reviewAssignments.length : 0;
});

AbstractSubmissionSchema.virtual('averageScore').get(function() {
  if (!this.populated('reviewAssignments') || this.reviewAssignments.length === 0) {
    return null;
  }
  
  const completedReviews = this.reviewAssignments.filter(review => review.status === 'completed');
  if (completedReviews.length === 0) return null;
  
  const totalScore = completedReviews.reduce((sum, review) => sum + review.overallScore, 0);
  return totalScore / completedReviews.length;
});

AbstractSubmissionSchema.virtual('isOverdue').get(function() {
  const now = new Date();
  
  if (this.status === 'draft' && this.submissionDeadline) {
    return now > this.submissionDeadline;
  }
  
  if (this.status === 'revision_requested' && this.revisionDeadline) {
    return now > this.revisionDeadline;
  }
  
  return false;
});

// Pre-save middleware
AbstractSubmissionSchema.pre('save', function(next) {
  // Generate submission ID if not exists
  if (!this.submissionId) {
    this.submissionId = `ABS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Update searchable text
  this.searchableText = [
    this.title,
    this.abstract,
    this.keywords.join(' '),
    this.authors.map(a => `${a.name} ${a.affiliation}`).join(' ')
  ].join(' ').toLowerCase();
  
  // Update timestamps
  this.lastModifiedAt = new Date();
  
  // If submitting for the first time
  if (this.status === 'submitted' && !this.submittedAt) {
    this.submittedAt = new Date();
  }
  
  next();
});

// Instance methods
AbstractSubmissionSchema.methods.createRevision = function(changes, submittedBy) {
  this.version += 1;
  this.revisionHistory.push({
    version: this.version,
    submittedAt: new Date(),
    submittedBy: submittedBy,
    changes: changes
  });
  
  this.status = 'revised';
  return this.save();
};

AbstractSubmissionSchema.methods.assignReviewer = function(reviewerId, assignedBy) {
  const AbstractReview = mongoose.model('AbstractReview');
  
  const review = new AbstractReview({
    abstractId: this._id,
    reviewerId: reviewerId,
    assignedBy: assignedBy,
    assignedAt: new Date(),
    reviewRound: this.reviewRound,
    isBlindReview: this.isBlindReview
  });
  
  return review.save().then(savedReview => {
    this.reviewAssignments.push(savedReview._id);
    return this.save();
  });
};

AbstractSubmissionSchema.methods.calculateFinalDecision = function() {
  if (!this.populated('reviewAssignments')) {
    return this.populate('reviewAssignments');
  }
  
  const completedReviews = this.reviewAssignments.filter(review => review.status === 'completed');
  
  if (completedReviews.length === 0) {
    return { decision: 'pending', reason: 'No completed reviews' };
  }
  
  const avgScore = completedReviews.reduce((sum, review) => sum + review.overallScore, 0) / completedReviews.length;
  const recommendations = completedReviews.map(review => review.recommendation);
  
  // Count recommendations
  const acceptCount = recommendations.filter(r => r === 'accept').length;
  const rejectCount = recommendations.filter(r => r === 'reject').length;
  const revisionCount = recommendations.filter(r => r === 'revision').length;
  
  // Decision logic
  if (acceptCount > rejectCount && avgScore >= 3.5) {
    return { decision: 'accepted', score: avgScore, recommendations };
  } else if (rejectCount > acceptCount || avgScore < 2.0) {
    return { decision: 'rejected', score: avgScore, recommendations };
  } else {
    return { decision: 'revision_required', score: avgScore, recommendations };
  }
};

AbstractSubmissionSchema.methods.setFinalDecision = function(decision, decidedBy, comments, overrideReason) {
  this.finalDecision = {
    decision: decision,
    decidedBy: decidedBy,
    decidedAt: new Date(),
    comments: comments,
    overrideReason: overrideReason
  };
  
  this.status = decision === 'revision_required' ? 'revision_requested' : decision;
  
  return this.save();
};

AbstractSubmissionSchema.methods.withdraw = function(reason, withdrawnBy) {
  this.status = 'withdrawn';
  this.withdrawalReason = reason;
  this.withdrawnBy = withdrawnBy;
  this.withdrawnAt = new Date();
  
  return this.save();
};

AbstractSubmissionSchema.methods.anonymize = function() {
  if (!this.isBlindReview) {
    return this;
  }
  
  // Remove identifying information for blind review
  const anonymized = this.toObject();
  delete anonymized.authors;
  delete anonymized.submittedBy;
  anonymized.title = this.anonymizedTitle || this.title;
  anonymized.abstract = this.anonymizedAbstract || this.abstract;
  
  return anonymized;
};

// Static methods
AbstractSubmissionSchema.statics.findByEvent = function(eventId, filters = {}) {
  const query = { eventId, isDeleted: false, ...filters };
  return this.find(query).populate('submittedBy reviewAssignments');
};

AbstractSubmissionSchema.statics.findOverdue = function() {
  const now = new Date();
  return this.find({
    $or: [
      { status: 'draft', submissionDeadline: { $lt: now } },
      { status: 'revision_requested', revisionDeadline: { $lt: now } }
    ],
    isDeleted: false
  });
};

AbstractSubmissionSchema.statics.getSubmissionStats = function(eventId) {
  return this.aggregate([
    { $match: { eventId: mongoose.Types.ObjectId(eventId), isDeleted: false } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgScore: { $avg: '$averageScore' }
      }
    }
  ]);
};

AbstractSubmissionSchema.statics.bulkUpdateStatus = function(submissionIds, status, updatedBy) {
  return this.updateMany(
    { _id: { $in: submissionIds } },
    { 
      $set: { 
        status: status,
        lastModifiedAt: new Date(),
        'statusHistory': {
          status: status,
          changedBy: updatedBy,
          changedAt: new Date()
        }
      }
    }
  );
};

module.exports = mongoose.model('AbstractSubmission', AbstractSubmissionSchema);
