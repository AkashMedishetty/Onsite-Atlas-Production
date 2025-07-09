const mongoose = require('mongoose');

const AbstractReviewSchema = new mongoose.Schema({
  abstract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Abstract',
    required: true,
    index: true
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  
  // Review Assignment
  assignedAt: {
    type: Date,
    default: Date.now
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  
  // Review Status
  status: {
    type: String,
    enum: ['assigned', 'in_progress', 'completed', 'declined', 'overdue'],
    default: 'assigned',
    index: true
  },
  
  // Review Content
  scores: {
    relevance: {
      type: Number,
      min: 1,
      max: 10
    },
    methodology: {
      type: Number,
      min: 1,
      max: 10
    },
    clarity: {
      type: Number,
      min: 1,
      max: 10
    },
    originality: {
      type: Number,
      min: 1,
      max: 10
    },
    significance: {
      type: Number,
      min: 1,
      max: 10
    },
    overall: {
      type: Number,
      min: 1,
      max: 10
    }
  },
  
  comments: {
    strengths: String,
    weaknesses: String,
    improvements: String,
    confidential: String, // Comments only visible to organizers
    publicFeedback: String // Comments visible to authors
  },
  
  recommendation: {
    type: String,
    enum: ['accept', 'reject', 'minor_revision', 'major_revision', 'pending'],
    default: 'pending'
  },
  
  // Review Completion
  submittedAt: Date,
  completedAt: Date,
  
  // Reviewer Experience
  expertise: {
    type: String,
    enum: ['expert', 'knowledgeable', 'some_knowledge', 'limited_knowledge'],
    required: true
  },
  confidence: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  
  // Review Metadata
  timeSpent: Number, // in minutes
  reviewRound: {
    type: Number,
    default: 1
  },
  
  // Revision tracking
  revisions: [{
    revisedAt: Date,
    changes: String,
    revisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Conflict of Interest
  conflictOfInterest: {
    declared: {
      type: Boolean,
      default: false
    },
    description: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date
  },
  
  // Quality Assurance
  qualityScore: {
    type: Number,
    min: 1,
    max: 5
  },
  flagged: {
    type: Boolean,
    default: false
  },
  flagReason: String,
  
  // Notifications
  notifications: {
    assigned: {
      sent: Boolean,
      sentAt: Date
    },
    reminder: {
      sent: Boolean,
      sentAt: Date,
      count: {
        type: Number,
        default: 0
      }
    },
    completed: {
      sent: Boolean,
      sentAt: Date
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
AbstractReviewSchema.index({ abstract: 1, reviewer: 1 }, { unique: true });
AbstractReviewSchema.index({ event: 1, status: 1 });
AbstractReviewSchema.index({ reviewer: 1, status: 1 });
AbstractReviewSchema.index({ dueDate: 1, status: 1 });

// Virtual fields
AbstractReviewSchema.virtual('isOverdue').get(function() {
  return this.status !== 'completed' && this.dueDate < new Date();
});

AbstractReviewSchema.virtual('averageScore').get(function() {
  if (!this.scores) return null;
  
  const scores = Object.values(this.scores).filter(score => typeof score === 'number');
  if (scores.length === 0) return null;
  
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
});

AbstractReviewSchema.virtual('completionRate').get(function() {
  const requiredFields = ['scores', 'comments', 'recommendation'];
  let completed = 0;
  
  if (this.scores && Object.keys(this.scores).length > 0) completed++;
  if (this.comments && (this.comments.strengths || this.comments.weaknesses)) completed++;
  if (this.recommendation && this.recommendation !== 'pending') completed++;
  
  return Math.round((completed / requiredFields.length) * 100);
});

// Instance methods
AbstractReviewSchema.methods.startReview = function() {
  this.status = 'in_progress';
  return this.save();
};

AbstractReviewSchema.methods.submitReview = function(reviewData) {
  this.scores = reviewData.scores;
  this.comments = reviewData.comments;
  this.recommendation = reviewData.recommendation;
  this.expertise = reviewData.expertise;
  this.confidence = reviewData.confidence;
  this.timeSpent = reviewData.timeSpent;
  this.status = 'completed';
  this.submittedAt = new Date();
  this.completedAt = new Date();
  
  return this.save();
};

AbstractReviewSchema.methods.decline = function(reason) {
  this.status = 'declined';
  this.comments = { confidential: reason };
  return this.save();
};

AbstractReviewSchema.methods.extend = function(newDueDate) {
  this.dueDate = newDueDate;
  return this.save();
};

AbstractReviewSchema.methods.flag = function(reason) {
  this.flagged = true;
  this.flagReason = reason;
  return this.save();
};

AbstractReviewSchema.methods.addRevision = function(changes, revisedBy) {
  this.revisions.push({
    revisedAt: new Date(),
    changes,
    revisedBy
  });
  return this.save();
};

// Static methods
AbstractReviewSchema.statics.getReviewsByAbstract = function(abstractId) {
  return this.find({ abstract: abstractId }).populate('reviewer', 'name email');
};

AbstractReviewSchema.statics.getReviewsByReviewer = function(reviewerId, status = null) {
  const query = { reviewer: reviewerId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('abstract', 'title authors status')
    .populate('event', 'title');
};

AbstractReviewSchema.statics.getOverdueReviews = function() {
  return this.find({
    status: { $in: ['assigned', 'in_progress'] },
    dueDate: { $lt: new Date() }
  })
  .populate('reviewer', 'name email')
  .populate('abstract', 'title')
  .populate('event', 'title');
};

AbstractReviewSchema.statics.getReviewStats = function(eventId) {
  return this.aggregate([
    { $match: { event: mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgScore: { $avg: '$scores.overall' }
      }
    }
  ]);
};

AbstractReviewSchema.statics.getReviewerWorkload = function(eventId) {
  return this.aggregate([
    { $match: { event: mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: '$reviewer',
        assigned: { $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        total: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'reviewer'
      }
    },
    { $unwind: '$reviewer' },
    {
      $project: {
        reviewerName: '$reviewer.name',
        reviewerEmail: '$reviewer.email',
        assigned: 1,
        inProgress: 1,
        completed: 1,
        total: 1,
        completionRate: { $multiply: [{ $divide: ['$completed', '$total'] }, 100] }
      }
    }
  ]);
};

// Middleware
AbstractReviewSchema.pre('save', function(next) {
  // Mark as overdue if past due date
  if (this.status !== 'completed' && this.dueDate < new Date()) {
    this.status = 'overdue';
  }
  
  next();
});

AbstractReviewSchema.post('save', function(doc) {
  // Emit events for review lifecycle
  const eventName = `review.${doc.status}`;
  if (doc.constructor.emit) {
    doc.constructor.emit(eventName, doc);
  }
});

module.exports = mongoose.model('AbstractReview', AbstractReviewSchema);
