const mongoose = require('mongoose');
const logger = require('../utils/logger');
const NotificationService = require('./NotificationService');
const EventEmitter = require('events');

class AbstractService extends EventEmitter {
  constructor() {
    super();
    this.Abstract = require('../models/Abstract');
    this.AbstractReview = require('../models/AbstractReview');
    this.AbstractCategory = require('../models/AbstractCategory');
    this.Event = require('../models/Event');
    this.User = require('../models/User');
    this.notificationService = new NotificationService();
  }

  // Abstract submission workflow
  async submitAbstract(abstractData, userId) {
    try {
      const session = await mongoose.startSession();
      session.startTransaction();

      const event = await this.Event.findById(abstractData.eventId).session(session);
      if (!event) {
        throw new Error('Event not found');
      }

      // Check submission deadlines
      const now = new Date();
      if (event.abstractSettings.submissionDeadline && now > event.abstractSettings.submissionDeadline) {
        throw new Error('Abstract submission deadline has passed');
      }

      // Check if user has reached submission limit
      if (event.abstractSettings.maxAbstractsPerUser) {
        const existingAbstracts = await this.Abstract.countDocuments({
          eventId: abstractData.eventId,
          submittedBy: userId,
          status: { $ne: 'withdrawn' }
        }).session(session);

        if (existingAbstracts >= event.abstractSettings.maxAbstractsPerUser) {
          throw new Error('Maximum abstracts per user limit reached');
        }
      }

      // Create abstract
      const abstractDoc = new this.Abstract({
        ...abstractData,
        submittedBy: userId,
        status: 'submitted',
        submissionNumber: await this.generateSubmissionNumber(abstractData.eventId, session),
        timeline: [{
          status: 'submitted',
          timestamp: new Date(),
          userId: userId,
          notes: 'Abstract submitted'
        }]
      });

      await abstractDoc.save({ session });

      // Auto-assign reviewers if enabled
      if (event.abstractSettings.autoAssignReviewers) {
        await this.autoAssignReviewers(abstractDoc._id, event, session);
      }

      await session.commitTransaction();
      
      // Send notifications
      await this.notificationService.sendNotification({
        type: 'abstract_submitted',
        recipients: [userId],
        data: {
          abstract: abstractDoc,
          event: event,
          submissionNumber: abstractDoc.submissionNumber
        }
      });

      // Notify event organizers
      await this.notificationService.sendNotification({
        type: 'abstract_received',
        recipients: event.organizers.map(org => org.userId),
        data: {
          abstract: abstractDoc,
          event: event,
          submissionNumber: abstractDoc.submissionNumber
        }
      });

      this.emit('abstractSubmitted', {
        abstractId: abstractDoc._id,
        eventId: abstractData.eventId,
        userId: userId
      });

      return abstractDoc;

    } catch (error) {
      logger.error('Abstract submission failed:', error);
      throw error;
    }
  }

  // Review assignment workflow
  async assignReviewers(abstractId, reviewerIds, assignedBy) {
    try {
      const abstractDoc = await this.Abstract.findById(abstractId).populate('eventId');
      if (!abstractDoc) {
        throw new Error('Abstract not found');
      }

      const event = abstractDoc.eventId;
      const reviewersPerAbstract = event.abstractSettings.reviewersPerAbstract || 2;

      // Validate reviewer count
      if (reviewerIds.length > reviewersPerAbstract) {
        throw new Error(`Maximum ${reviewersPerAbstract} reviewers allowed per abstract`);
      }

      // Check if reviewers are eligible
      const reviewers = await this.User.find({
        _id: { $in: reviewerIds },
        'roles.eventId': event._id,
        'roles.role': 'reviewer'
      });

      if (reviewers.length !== reviewerIds.length) {
        throw new Error('Some reviewers are not eligible for this event');
      }

      // Check for conflicts of interest
      const conflicts = await this.checkConflictsOfInterest(abstractDoc, reviewerIds);
      if (conflicts.length > 0) {
        throw new Error(`Conflicts of interest detected: ${conflicts.join(', ')}`);
      }

      // Create review assignments
      const reviewAssignments = [];
      for (const reviewerId of reviewerIds) {
        // Check if reviewer is already assigned
        const existingReview = await this.AbstractReview.findOne({
          abstractId: abstractId,
          reviewerId: reviewerId
        });

        if (!existingReview) {
          const review = new this.AbstractReview({
            abstractId: abstractId,
            reviewerId: reviewerId,
            assignedBy: assignedBy,
            assignedAt: new Date(),
            status: 'assigned',
            dueDate: event.abstractSettings.reviewDeadline,
            isBlind: event.abstractSettings.anonymousReview
          });

          await review.save();
          reviewAssignments.push(review);
        }
      }

      // Update abstract status
      await this.Abstract.findByIdAndUpdate(abstractId, {
        $push: {
          timeline: {
            status: 'under_review',
            timestamp: new Date(),
            userId: assignedBy,
            notes: `Reviewers assigned: ${reviewers.map(r => r.name).join(', ')}`
          }
        },
        status: 'under_review'
      });

      // Send notifications to reviewers
      for (const review of reviewAssignments) {
        await this.notificationService.sendNotification({
          type: 'review_assignment',
          recipients: [review.reviewerId],
          data: {
            abstract: abstractDoc,
            review: review,
            event: event,
            dueDate: review.dueDate
          }
        });
      }

      this.emit('reviewersAssigned', {
        abstractId: abstractId,
        reviewerIds: reviewerIds,
        assignedBy: assignedBy
      });

      return reviewAssignments;

    } catch (error) {
      logger.error('Reviewer assignment failed:', error);
      throw error;
    }
  }

  // Auto-assign reviewers based on expertise and availability
  async autoAssignReviewers(abstractId, event, session) {
    try {
      const abstractDoc = await this.Abstract.findById(abstractId).session(session);
      if (!abstractDoc) {
        throw new Error('Abstract not found');
      }

      const reviewersNeeded = event.abstractSettings.reviewersPerAbstract || 2;
      
      // Find eligible reviewers
      const eligibleReviewers = await this.User.find({
        'roles.eventId': event._id,
        'roles.role': 'reviewer',
        'profile.expertise': { $in: abstractDoc.keywords || [] }
      }).session(session);

      // Score reviewers based on expertise match and workload
      const scoredReviewers = await Promise.all(
        eligibleReviewers.map(async (reviewer) => {
          const expertiseMatch = this.calculateExpertiseMatch(
            abstractDoc.keywords || [],
            reviewer.profile.expertise || []
          );

          const currentWorkload = await this.AbstractReview.countDocuments({
            reviewerId: reviewer._id,
            status: { $in: ['assigned', 'in_progress'] }
          }).session(session);

          const score = expertiseMatch * 0.7 + (1 / (currentWorkload + 1)) * 0.3;
          
          return {
            reviewerId: reviewer._id,
            score: score,
            workload: currentWorkload
          };
        })
      );

      // Sort by score and select top reviewers
      scoredReviewers.sort((a, b) => b.score - a.score);
      const selectedReviewers = scoredReviewers
        .slice(0, reviewersNeeded)
        .map(r => r.reviewerId);

      if (selectedReviewers.length < reviewersNeeded) {
        logger.warn(`Only ${selectedReviewers.length} reviewers available for abstract ${abstractId}`);
      }

      // Create review assignments
      for (const reviewerId of selectedReviewers) {
        const review = new this.AbstractReview({
          abstractId: abstractId,
          reviewerId: reviewerId,
          assignedBy: null, // Auto-assigned
          assignedAt: new Date(),
          status: 'assigned',
          dueDate: event.abstractSettings.reviewDeadline,
          isBlind: event.abstractSettings.anonymousReview,
          isAutoAssigned: true
        });

        await review.save({ session });
      }

      return selectedReviewers;

    } catch (error) {
      logger.error('Auto-assignment failed:', error);
      throw error;
    }
  }

  // Submit review
  async submitReview(reviewId, reviewData, reviewerId) {
    try {
      const review = await this.AbstractReview.findById(reviewId)
        .populate('abstractId')
        .populate('reviewerId');

      if (!review) {
        throw new Error('Review not found');
      }

      if (!review.reviewerId._id.equals(reviewerId)) {
        throw new Error('Unauthorized to submit this review');
      }

      if (review.status === 'completed') {
        throw new Error('Review already submitted');
      }

      // Update review
      review.status = 'completed';
      review.rating = reviewData.rating;
      review.comments = reviewData.comments;
      review.recommendation = reviewData.recommendation;
      review.confidentialComments = reviewData.confidentialComments;
      review.submittedAt = new Date();

      // Add detailed scores if provided
      if (reviewData.scores) {
        review.detailedScores = reviewData.scores;
      }

      await review.save();

      // Check if all reviews are complete
      const allReviews = await this.AbstractReview.find({
        abstractId: review.abstractId._id
      });

      const completedReviews = allReviews.filter(r => r.status === 'completed');
      
      if (completedReviews.length === allReviews.length) {
        // All reviews completed, calculate final decision
        await this.calculateFinalDecision(review.abstractId._id);
      }

      // Send notifications
      await this.notificationService.sendNotification({
        type: 'review_submitted',
        recipients: [review.abstractId.submittedBy],
        data: {
          abstract: review.abstractId,
          review: review,
          totalReviews: allReviews.length,
          completedReviews: completedReviews.length
        }
      });

      this.emit('reviewSubmitted', {
        reviewId: reviewId,
        abstractId: review.abstractId._id,
        reviewerId: reviewerId
      });

      return review;

    } catch (error) {
      logger.error('Review submission failed:', error);
      throw error;
    }
  }

  // Calculate final decision based on reviews
  async calculateFinalDecision(abstractId) {
    try {
      const reviews = await this.AbstractReview.find({
        abstractId: abstractId,
        status: 'completed'
      });

      if (reviews.length === 0) {
        return;
      }

      // Calculate average rating
      const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

      // Determine recommendation based on individual recommendations
      const recommendations = reviews.map(r => r.recommendation);
      const acceptCount = recommendations.filter(r => r === 'accept').length;
      const rejectCount = recommendations.filter(r => r === 'reject').length;
      const reviseCount = recommendations.filter(r => r === 'revise').length;

      let finalDecision = 'pending';
      
      // Decision logic
      if (acceptCount > rejectCount && acceptCount > reviseCount) {
        finalDecision = 'accepted';
      } else if (rejectCount > acceptCount && rejectCount > reviseCount) {
        finalDecision = 'rejected';
      } else if (reviseCount > 0) {
        finalDecision = 'revision_required';
      } else {
        finalDecision = 'pending'; // Tied votes require manual decision
      }

      // Update abstract
      const abstractDoc = await this.Abstract.findByIdAndUpdate(
        abstractId,
        {
          $push: {
            timeline: {
              status: finalDecision,
              timestamp: new Date(),
              userId: null,
              notes: `System decision based on ${reviews.length} reviews`
            }
          },
          status: finalDecision,
          finalRating: averageRating,
          reviewSummary: {
            averageRating: averageRating,
            totalReviews: reviews.length,
            acceptRecommendations: acceptCount,
            rejectRecommendations: rejectCount,
            reviseRecommendations: reviseCount
          }
        },
        { new: true }
      ).populate('eventId');

      // Send decision notification
      await this.notificationService.sendNotification({
        type: 'abstract_decision',
        recipients: [abstractDoc.submittedBy],
        data: {
          abstract: abstractDoc,
          decision: finalDecision,
          rating: averageRating,
          reviewCount: reviews.length
        }
      });

      this.emit('abstractDecision', {
        abstractId: abstractId,
        decision: finalDecision,
        rating: averageRating
      });

      return abstractDoc;

    } catch (error) {
      logger.error('Final decision calculation failed:', error);
      throw error;
    }
  }

  // Manual decision override
  async makeManualDecision(abstractId, decision, userId, notes) {
    try {
      const validDecisions = ['accepted', 'rejected', 'revision_required', 'pending'];
      if (!validDecisions.includes(decision)) {
        throw new Error('Invalid decision');
      }

      const abstractDoc = await this.Abstract.findByIdAndUpdate(
        abstractId,
        {
          $push: {
            timeline: {
              status: decision,
              timestamp: new Date(),
              userId: userId,
              notes: notes || `Manual decision: ${decision}`
            }
          },
          status: decision,
          manualDecision: {
            decision: decision,
            decidedBy: userId,
            decidedAt: new Date(),
            notes: notes
          }
        },
        { new: true }
      ).populate('eventId');

      // Send notification
      await this.notificationService.sendNotification({
        type: 'abstract_decision',
        recipients: [abstractDoc.submittedBy],
        data: {
          abstract: abstractDoc,
          decision: decision,
          notes: notes,
          isManualDecision: true
        }
      });

      this.emit('manualDecision', {
        abstractId: abstractId,
        decision: decision,
        userId: userId
      });

      return abstractDoc;

    } catch (error) {
      logger.error('Manual decision failed:', error);
      throw error;
    }
  }

  // Allow abstract revisions
  async submitRevision(abstractId, revisionData, userId) {
    try {
      const abstractDoc = await this.Abstract.findById(abstractId);
      if (!abstractDoc) {
        throw new Error('Abstract not found');
      }

      if (!abstractDoc.submittedBy.equals(userId)) {
        throw new Error('Unauthorized to revise this abstract');
      }

      if (abstractDoc.status !== 'revision_required') {
        throw new Error('Abstract is not in revision required status');
      }

      // Save previous version
      const previousVersion = {
        title: abstractDoc.title,
        content: abstractDoc.content,
        keywords: abstractDoc.keywords,
        authors: abstractDoc.authors,
        versionNumber: abstractDoc.versionNumber,
        updatedAt: abstractDoc.updatedAt
      };

      // Update abstract
      abstractDoc.title = revisionData.title || abstractDoc.title;
      abstractDoc.content = revisionData.content || abstractDoc.content;
      abstractDoc.keywords = revisionData.keywords || abstractDoc.keywords;
      abstractDoc.authors = revisionData.authors || abstractDoc.authors;
      abstractDoc.versionNumber = (abstractDoc.versionNumber || 1) + 1;
      abstractDoc.status = 'revised';
      
      abstractDoc.previousVersions = abstractDoc.previousVersions || [];
      abstractDoc.previousVersions.push(previousVersion);

      abstractDoc.timeline.push({
        status: 'revised',
        timestamp: new Date(),
        userId: userId,
        notes: `Revision submitted (v${abstractDoc.versionNumber})`
      });

      await abstractDoc.save();

      // Notify reviewers about revision
      const reviews = await this.AbstractReview.find({ abstractId: abstractId });
      const reviewerIds = reviews.map(r => r.reviewerId);

      await this.notificationService.sendNotification({
        type: 'abstract_revised',
        recipients: reviewerIds,
        data: {
          abstract: abstractDoc,
          version: abstractDoc.versionNumber
        }
      });

      this.emit('abstractRevised', {
        abstractId: abstractId,
        version: abstractDoc.versionNumber,
        userId: userId
      });

      return abstractDoc;

    } catch (error) {
      logger.error('Abstract revision failed:', error);
      throw error;
    }
  }

  // Bulk operations
  async bulkAssignReviewers(assignments, assignedBy) {
    try {
      const results = [];
      
      for (const assignment of assignments) {
        try {
          const result = await this.assignReviewers(
            assignment.abstractId,
            assignment.reviewerIds,
            assignedBy
          );
          results.push({ abstractId: assignment.abstractId, success: true, result });
        } catch (error) {
          results.push({ 
            abstractId: assignment.abstractId, 
            success: false, 
            error: error.message 
          });
        }
      }

      return results;

    } catch (error) {
      logger.error('Bulk reviewer assignment failed:', error);
      throw error;
    }
  }

  async bulkDecisions(decisions, userId) {
    try {
      const results = [];
      
      for (const decision of decisions) {
        try {
          const result = await this.makeManualDecision(
            decision.abstractId,
            decision.decision,
            userId,
            decision.notes
          );
          results.push({ abstractId: decision.abstractId, success: true, result });
        } catch (error) {
          results.push({ 
            abstractId: decision.abstractId, 
            success: false, 
            error: error.message 
          });
        }
      }

      return results;

    } catch (error) {
      logger.error('Bulk decisions failed:', error);
      throw error;
    }
  }

  // Helper methods
  async generateSubmissionNumber(eventId, session) {
    const count = await this.Abstract.countDocuments({ eventId }).session(session);
    return `ABS-${eventId.toString().slice(-6).toUpperCase()}-${(count + 1).toString().padStart(4, '0')}`;
  }

  calculateExpertiseMatch(abstractKeywords, reviewerExpertise) {
    if (!abstractKeywords.length || !reviewerExpertise.length) {
      return 0;
    }

    const matches = abstractKeywords.filter(keyword => 
      reviewerExpertise.some(expertise => 
        expertise.toLowerCase().includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(expertise.toLowerCase())
      )
    );

    return matches.length / abstractKeywords.length;
  }

  async checkConflictsOfInterest(abstractDoc, reviewerIds) {
    const conflicts = [];
    
    // Check if any reviewer is an author
    const authorEmails = abstractDoc.authors.map(author => author.email.toLowerCase());
    const reviewers = await this.User.find({ _id: { $in: reviewerIds } });
    
    for (const reviewer of reviewers) {
      if (authorEmails.includes(reviewer.email.toLowerCase())) {
        conflicts.push(`${reviewer.name} is an author`);
      }
    }

    // Add more conflict checks as needed (same institution, etc.)
    
    return conflicts;
  }

  // Analytics and reporting
  async getReviewStatistics(eventId) {
    try {
      const abstracts = await this.Abstract.find({ eventId }).populate('reviews');
      
      const stats = {
        totalAbstracts: abstracts.length,
        byStatus: {},
        reviewProgress: {
          totalReviews: 0,
          completedReviews: 0,
          averageRating: 0
        },
        timeline: {}
      };

      // Count by status
      abstracts.forEach(abstract => {
        stats.byStatus[abstract.status] = (stats.byStatus[abstract.status] || 0) + 1;
      });

      // Review statistics
      const allReviews = await this.AbstractReview.find({
        abstractId: { $in: abstracts.map(a => a._id) }
      });

      stats.reviewProgress.totalReviews = allReviews.length;
      stats.reviewProgress.completedReviews = allReviews.filter(r => r.status === 'completed').length;
      
      const completedReviews = allReviews.filter(r => r.status === 'completed' && r.rating);
      if (completedReviews.length > 0) {
        stats.reviewProgress.averageRating = completedReviews.reduce((sum, r) => sum + r.rating, 0) / completedReviews.length;
      }

      return stats;

    } catch (error) {
      logger.error('Review statistics failed:', error);
      throw error;
    }
  }

  // Reminder system
  async sendReviewReminders(eventId) {
    try {
      const overdueReviews = await this.AbstractReview.find({
        status: 'assigned',
        dueDate: { $lt: new Date() }
      }).populate('abstractId reviewerId');

      for (const review of overdueReviews) {
        if (review.abstractId.eventId.toString() === eventId) {
          await this.notificationService.sendNotification({
            type: 'review_overdue',
            recipients: [review.reviewerId._id],
            data: {
              review: review,
              abstract: review.abstractId,
              daysPastDue: Math.ceil((new Date() - review.dueDate) / (1000 * 60 * 60 * 24))
            }
          });
        }
      }

      return overdueReviews.length;

    } catch (error) {
      logger.error('Review reminders failed:', error);
      throw error;
    }
  }
}

module.exports = AbstractService;
