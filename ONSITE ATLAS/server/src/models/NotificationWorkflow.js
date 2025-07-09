const mongoose = require('mongoose');

const workflowStepSchema = new mongoose.Schema({
  stepId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    enum: ['email', 'sms', 'whatsapp', 'inApp', 'push'],
    default: 'email'
  },
  delay: {
    type: Number, // Delay in milliseconds
    default: 0
  },
  condition: {
    field: String,
    operator: String, // equals, contains, greater_than, etc.
    value: mongoose.Schema.Types.Mixed
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NotificationTemplate'
  },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'sent', 'failed', 'skipped'],
    default: 'pending'
  },
  scheduledDate: Date,
  executedAt: Date,
  error: String,
  nextSteps: [String], // Array of step IDs that should execute after this step
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  }
});

const notificationWorkflowSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  workflowType: {
    type: String,
    required: true,
    enum: [
      'registration_confirmation',
      'payment_processing', 
      'abstract_review',
      'event_reminder',
      'certificate_distribution',
      'announcement',
      'custom'
    ]
  },
  triggerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true // ID of the entity that triggered this workflow
  },
  triggerType: {
    type: String,
    enum: ['Registration', 'Payment', 'Abstract', 'Event', 'User'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'failed', 'cancelled'],
    default: 'active'
  },
  steps: [workflowStepSchema],
  currentStepIndex: {
    type: Number,
    default: 0
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  pausedAt: Date,
  cancelledAt: Date,
  priority: {
    type: String,
    enum: ['critical', 'high', 'normal', 'low'],
    default: 'normal'
  },
  metadata: {
    recipientIds: [mongoose.Schema.Types.ObjectId],
    templateData: mongoose.Schema.Types.Mixed,
    customData: mongoose.Schema.Types.Mixed
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastExecutedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
notificationWorkflowSchema.index({ eventId: 1, status: 1 });
notificationWorkflowSchema.index({ workflowType: 1, triggerId: 1 });
notificationWorkflowSchema.index({ status: 1, 'steps.scheduledDate': 1 });

// Static methods
notificationWorkflowSchema.statics.createWorkflowFromTemplate = async function(templateType, eventId, triggerId, triggerType, createdBy, customData = {}) {
  const workflows = {
    'registration_confirmation': {
      name: 'Registration Confirmation Workflow',
      description: 'Automated workflow for registration confirmation and follow-ups',
      steps: [
        {
          stepId: 'immediate_confirmation',
          type: 'registration_confirmation',
          channel: 'email',
          delay: 0,
          nextSteps: ['payment_reminder']
        },
        {
          stepId: 'payment_reminder',
          type: 'payment_reminder',
          channel: 'email',
          delay: 24 * 60 * 60 * 1000, // 24 hours
          condition: {
            field: 'paymentStatus',
            operator: 'equals',
            value: 'pending'
          },
          nextSteps: ['final_payment_reminder']
        },
        {
          stepId: 'final_payment_reminder',
          type: 'payment_final_reminder',
          channel: 'email',
          delay: 72 * 60 * 60 * 1000, // 72 hours
          condition: {
            field: 'paymentStatus',
            operator: 'equals',
            value: 'pending'
          },
          nextSteps: []
        }
      ]
    },
    'abstract_review': {
      name: 'Abstract Review Workflow',
      description: 'Automated workflow for abstract review process',
      steps: [
        {
          stepId: 'submission_confirmation',
          type: 'abstract_confirmation',
          channel: 'email',
          delay: 0,
          nextSteps: ['review_assignment']
        },
        {
          stepId: 'review_assignment',
          type: 'review_assignment',
          channel: 'email',
          delay: 60 * 60 * 1000, // 1 hour
          nextSteps: ['review_reminder_1']
        },
        {
          stepId: 'review_reminder_1',
          type: 'review_reminder',
          channel: 'email',
          delay: 7 * 24 * 60 * 60 * 1000, // 7 days
          condition: {
            field: 'reviewStatus',
            operator: 'equals',
            value: 'pending'
          },
          nextSteps: ['review_reminder_2']
        },
        {
          stepId: 'review_reminder_2',
          type: 'review_final_reminder',
          channel: 'email',
          delay: 14 * 24 * 60 * 60 * 1000, // 14 days
          condition: {
            field: 'reviewStatus',
            operator: 'equals',
            value: 'pending'
          },
          nextSteps: []
        }
      ]
    },
    'event_reminder': {
      name: 'Event Reminder Workflow',
      description: 'Automated event reminder notifications',
      steps: [
        {
          stepId: 'early_reminder',
          type: 'event_early_reminder',
          channel: 'email',
          delay: -7 * 24 * 60 * 60 * 1000, // 7 days before event
          nextSteps: ['final_reminder']
        },
        {
          stepId: 'final_reminder',
          type: 'event_final_reminder',
          channel: 'email',
          delay: -24 * 60 * 60 * 1000, // 24 hours before event
          nextSteps: ['day_of_reminder']
        },
        {
          stepId: 'day_of_reminder',
          type: 'event_day_reminder',
          channel: 'sms',
          delay: -2 * 60 * 60 * 1000, // 2 hours before event
          nextSteps: []
        }
      ]
    }
  };

  const template = workflows[templateType];
  if (!template) {
    throw new Error(`Unknown workflow template: ${templateType}`);
  }

  const workflow = new this({
    ...template,
    eventId,
    workflowType: templateType,
    triggerId,
    triggerType,
    createdBy,
    metadata: {
      ...customData
    }
  });

  return await workflow.save();
};

notificationWorkflowSchema.statics.getActiveWorkflows = async function() {
  return await this.find({
    status: 'active',
    'steps.status': 'scheduled',
    'steps.scheduledDate': { $lte: new Date() }
  }).populate('eventId', 'name startDate endDate');
};

// Instance methods
notificationWorkflowSchema.methods.executeNextStep = async function() {
  const currentStep = this.steps[this.currentStepIndex];
  if (!currentStep || currentStep.status === 'sent') {
    return null;
  }

  try {
    // Check condition if exists
    if (currentStep.condition) {
      const conditionMet = await this.evaluateCondition(currentStep.condition);
      if (!conditionMet) {
        currentStep.status = 'skipped';
        currentStep.executedAt = new Date();
        await this.moveToNextStep();
        return this.executeNextStep();
      }
    }

    // Execute the step
    const NotificationService = require('../services/NotificationService');
    
    const result = await NotificationService.sendNotification(
      currentStep.channel,
      currentStep.type,
      this.eventId,
      this.metadata.recipientIds,
      this.metadata.templateData
    );

    currentStep.status = 'sent';
    currentStep.executedAt = new Date();
    
    await this.save();
    await this.scheduleNextSteps(currentStep);
    
    return result;

  } catch (error) {
    currentStep.status = 'failed';
    currentStep.error = error.message;
    currentStep.retryCount += 1;
    
    if (currentStep.retryCount < currentStep.maxRetries) {
      // Schedule retry
      currentStep.scheduledDate = new Date(Date.now() + Math.pow(2, currentStep.retryCount) * 60000); // Exponential backoff
      currentStep.status = 'scheduled';
    }
    
    await this.save();
    throw error;
  }
};

notificationWorkflowSchema.methods.scheduleNextSteps = async function(executedStep) {
  if (!executedStep.nextSteps || executedStep.nextSteps.length === 0) {
    // Check if this was the last step
    const remainingSteps = this.steps.filter(step => 
      step.status === 'pending' || step.status === 'scheduled'
    );
    
    if (remainingSteps.length === 0) {
      this.status = 'completed';
      this.completedAt = new Date();
    }
    
    await this.save();
    return;
  }

  for (const nextStepId of executedStep.nextSteps) {
    const nextStep = this.steps.find(step => step.stepId === nextStepId);
    if (nextStep && nextStep.status === 'pending') {
      nextStep.scheduledDate = new Date(Date.now() + nextStep.delay);
      nextStep.status = 'scheduled';
    }
  }

  await this.save();
};

notificationWorkflowSchema.methods.moveToNextStep = async function() {
  this.currentStepIndex += 1;
  return await this.save();
};

notificationWorkflowSchema.methods.pauseWorkflow = async function() {
  this.status = 'paused';
  this.pausedAt = new Date();
  
  // Update all scheduled steps to pending
  this.steps.forEach(step => {
    if (step.status === 'scheduled') {
      step.status = 'pending';
      step.scheduledDate = null;
    }
  });
  
  return await this.save();
};

notificationWorkflowSchema.methods.resumeWorkflow = async function() {
  this.status = 'active';
  this.pausedAt = null;
  
  // Reschedule pending steps
  const now = new Date();
  this.steps.forEach(step => {
    if (step.status === 'pending') {
      step.scheduledDate = new Date(now.getTime() + step.delay);
      step.status = 'scheduled';
    }
  });
  
  return await this.save();
};

notificationWorkflowSchema.methods.cancelWorkflow = async function() {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  
  // Update all pending/scheduled steps to cancelled
  this.steps.forEach(step => {
    if (step.status === 'pending' || step.status === 'scheduled') {
      step.status = 'skipped';
    }
  });
  
  return await this.save();
};

notificationWorkflowSchema.methods.evaluateCondition = async function(condition) {
  // This would need to be implemented based on your specific data models
  // For now, return true as a placeholder
  return true;
};

module.exports = mongoose.model('NotificationWorkflow', notificationWorkflowSchema);
