const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  // Event this resource belongs to
  event: {
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'Event',
    required: true,
    index: true
  },
  
  // Registration this resource is assigned to (if applicable)
  registration: {
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'Registration',
    index: true
  },
  
  // Resource type (food, kitBag, certificate)
  type: {
    type: String, trim: true,
    required: true,
    enum: ['food', 'kitBag', 'certificate', 'certificatePrinting'],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
    index: true
  },
  
  // Resource status
  status: {
    type: String, trim: true,
    enum: ['created', 'assigned', 'used', 'voided'],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
    default: 'created',
    index: true
  },
  
  // Resource-specific data (varies by type)
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // --- Denormalised registration info for ultra-fast scan history ---
  registrationId: {
    type: String, trim: true,
    index: true
  },
  firstName: String,
  lastName: String,
  categoryName: String,
  categoryColor: String,
  
  // Option ID (e.g., mealId, kitItemId) duplicated for fast index lookups
  resourceOption: {
    type: String, trim: true,
    index: true
  },
  
  resourceOptionName: String,
  
  // Reason if resource was voided
  voidReason: {
    type: String, trim: true
  },
  
  // User who created the resource
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'User',
    required: true
  },
  
  // User who last updated the resource
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'User'
  },
  
  // User who used/voided the resource
  actionBy: {
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'User'
  },
  
  // When was the resource used/voided
  actionDate: {
    type: Date
  },
  
  // Flag indicating a record has been voided (separate from status for quick filter)
  isVoided: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for fast scan-duplicate checks (uses denormalised resourceOption)
resourceSchema.index({
  event: 1,
  registration: 1,
  type: 1,
  resourceOption: 1,
  status: 1,
  isVoided: 1
});

// Create indexes to improve query performance
resourceSchema.index({ event: 1, type: 1 });
resourceSchema.index({ event: 1, registration: 1 });
resourceSchema.index({ event: 1, type: 1, status: 1 });

// Covering index for /recent-scans (index-only projection)
resourceSchema.index(
  {
    event: 1,
    type: 1,
    status: 1,
    actionDate: -1,
    registrationId: 1,
    firstName: 1,
    lastName: 1,
    categoryName: 1,
    resourceOption: 1
  },
  { name: 'recent_scans_cover', partialFilterExpression: { status: 'used' } }
);

const Resource = mongoose.model('Resource', resourceSchema);

module.exports = Resource;
