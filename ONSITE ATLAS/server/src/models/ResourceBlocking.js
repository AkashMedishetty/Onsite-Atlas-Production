const mongoose = require("mongoose");

const resourceBlockingSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  registration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: true,
    index: true
  },
  blockedResources: [{
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      required: true
    },
    resourceType: {
      type: String,
      enum: ['food', 'kit', 'certificate', 'certificate_printing', 'custom'],
      required: true
    },
    reason: {
      type: String,
      required: true,
      maxlength: 500
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    blockedAt: {
      type: Date,
      default: Date.now
    },
    active: {
      type: Boolean,
      default: true
    },
    expiresAt: {
      type: Date,
      default: null
    },
    metadata: {
      originalEntitlement: {
        type: Boolean,
        default: true
      },
      blockType: {
        type: String,
        enum: ['temporary', 'permanent', 'conditional'],
        default: 'permanent'
      },
      conditions: [{
        type: {
          type: String,
          enum: ['payment_received', 'verification_complete', 'manual_approval'],
        },
        satisfied: {
          type: Boolean,
          default: false
        },
        satisfiedAt: Date,
        satisfiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      }]
    }
  }],
  
  bulkOperation: {
    operationId: String,
    reason: String,
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    }
  },
  
  history: [{
    action: {
      type: String,
      enum: ['block_added', 'block_removed', 'block_modified', 'condition_satisfied'],
      required: true
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource'
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed,
    reason: String
  }],

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

resourceBlockingSchema.index({ event: 1, registration: 1 }, { unique: true });
resourceBlockingSchema.index({ 'blockedResources.resourceId': 1 });
resourceBlockingSchema.index({ 'blockedResources.active': 1 });
resourceBlockingSchema.index({ 'blockedResources.expiresAt': 1 });

resourceBlockingSchema.virtual('activeBlockedResources').get(function() {
  const now = new Date();
  return this.blockedResources.filter(resource => 
    resource.active && 
    (!resource.expiresAt || resource.expiresAt > now) &&
    !this.areConditionsSatisfied(resource)
  );
});

resourceBlockingSchema.methods.isResourceBlocked = function(resourceId) {
  const now = new Date();
  return this.blockedResources.some(resource => 
    resource.resourceId.toString() === resourceId.toString() &&
    resource.active &&
    (!resource.expiresAt || resource.expiresAt > now) &&
    !this.areConditionsSatisfied(resource)
  );
};

resourceBlockingSchema.methods.areConditionsSatisfied = function(blockedResource) {
  if (!blockedResource.metadata || !blockedResource.metadata.conditions || blockedResource.metadata.conditions.length === 0) {
    return false;
  }
  
  return blockedResource.metadata.conditions.every(condition => condition.satisfied);
};

resourceBlockingSchema.methods.getBlockedResourcesByType = function(resourceType) {
  return this.activeBlockedResources.filter(resource => resource.resourceType === resourceType);
};

resourceBlockingSchema.methods.addResourceBlock = function(resourceData, blockedBy, reason) {
  const existingBlock = this.blockedResources.find(resource => 
    resource.resourceId.toString() === resourceData.resourceId.toString() && 
    resource.active
  );
  
  if (existingBlock) {
    throw new Error('Resource is already blocked for this registration');
  }
  
  const blockData = {
    resourceId: resourceData.resourceId,
    resourceType: resourceData.resourceType,
    reason: reason,
    blockedBy: blockedBy,
    blockedAt: new Date(),
    active: true,
    expiresAt: resourceData.expiresAt || null,
    metadata: {
      originalEntitlement: resourceData.originalEntitlement !== false,
      blockType: resourceData.blockType || 'permanent',
      conditions: resourceData.conditions || []
    }
  };
  
  this.blockedResources.push(blockData);
  
  this.history.push({
    action: 'block_added',
    resourceId: resourceData.resourceId,
    performedBy: blockedBy,
    performedAt: new Date(),
    details: blockData,
    reason: reason
  });
  
  return blockData;
};

resourceBlockingSchema.methods.removeResourceBlock = function(resourceId, removedBy, reason) {
  const blockIndex = this.blockedResources.findIndex(resource => 
    resource.resourceId.toString() === resourceId.toString() && 
    resource.active
  );
  
  if (blockIndex === -1) {
    throw new Error('Resource block not found');
  }
  
  this.blockedResources[blockIndex].active = false;
  
  this.history.push({
    action: 'block_removed',
    resourceId: resourceId,
    performedBy: removedBy,
    performedAt: new Date(),
    reason: reason
  });
  
  return this.blockedResources[blockIndex];
};

resourceBlockingSchema.methods.satisfyCondition = function(resourceId, conditionType, satisfiedBy) {
  const blockedResource = this.blockedResources.find(resource => 
    resource.resourceId.toString() === resourceId.toString() && 
    resource.active
  );
  
  if (!blockedResource) {
    throw new Error('Blocked resource not found');
  }
  
  const condition = blockedResource.metadata.conditions.find(c => c.type === conditionType);
  if (!condition) {
    throw new Error('Condition not found');
  }
  
  condition.satisfied = true;
  condition.satisfiedAt = new Date();
  condition.satisfiedBy = satisfiedBy;
  
  this.history.push({
    action: 'condition_satisfied',
    resourceId: resourceId,
    performedBy: satisfiedBy,
    performedAt: new Date(),
    details: { conditionType, condition }
  });
  
  return condition;
};

resourceBlockingSchema.statics.findBlocksForRegistrations = function(registrationIds) {
  return this.find({
    registration: { $in: registrationIds }
  }).populate('registration', 'registrationId personalInfo')
    .populate('blockedResources.resourceId', 'name type')
    .populate('blockedResources.blockedBy', 'name email');
};

resourceBlockingSchema.statics.findBlocksForResource = function(resourceId) {
  return this.find({
    'blockedResources.resourceId': resourceId,
    'blockedResources.active': true
  }).populate('registration', 'registrationId personalInfo')
    .populate('blockedResources.blockedBy', 'name email');
};

resourceBlockingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

resourceBlockingSchema.post('save', function(doc) {
  console.log(`Resource blocking updated for registration: ${doc.registration}`);
});

const ResourceBlocking = mongoose.model('ResourceBlocking', resourceBlockingSchema);

module.exports = ResourceBlocking;
