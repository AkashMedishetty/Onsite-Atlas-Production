const mongoose = require('mongoose');

const eventTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['conference', 'workshop', 'seminar', 'meeting', 'training', 'webinar', 'other'],
    default: 'conference'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [String],
  
  // Event structure template
  eventStructure: {
    duration: {
      days: {
        type: Number,
        default: 1,
        min: 1
      },
      hoursPerDay: {
        type: Number,
        default: 8,
        min: 1
      }
    },
    timeSlots: [{
      name: String,
      startTime: String, // HH:MM format
      endTime: String,   // HH:MM format
      type: {
        type: String,
        enum: ['session', 'break', 'meal', 'networking', 'other'],
        default: 'session'
      },
      isOptional: {
        type: Boolean,
        default: false
      }
    }],
    tracks: [{
      name: String,
      description: String,
      color: String,
      capacity: Number
    }]
  },

  // Default settings template
  defaultSettings: {
    registrationSettings: {
      enabled: {
        type: Boolean,
        default: true
      },
      autoOpen: {
        type: Boolean,
        default: false
      },
      requireApproval: {
        type: Boolean,
        default: false
      },
      allowWaitlist: {
        type: Boolean,
        default: true
      },
      maxRegistrations: Number,
      earlyBirdEnabled: {
        type: Boolean,
        default: false
      },
      earlyBirdDiscount: {
        type: Number,
        min: 0,
        max: 100
      }
    },
    
    abstractSettings: {
      enabled: {
        type: Boolean,
        default: false
      },
      submissionDeadline: Date,
      reviewDeadline: Date,
      anonymousReview: {
        type: Boolean,
        default: false
      },
      maxAbstracts: Number,
      reviewersPerAbstract: {
        type: Number,
        default: 2,
        min: 1
      },
      allowRevisions: {
        type: Boolean,
        default: true
      }
    },

    paymentSettings: {
      enabled: {
        type: Boolean,
        default: false
      },
      provider: {
        type: String,
        enum: ['stripe', 'razorpay', 'paytm', 'cashfree', 'paypal'],
        default: 'stripe'
      },
      currency: {
        type: String,
        default: 'USD'
      },
      partialPayments: {
        type: Boolean,
        default: false
      },
      refundPolicy: String
    },

    notificationSettings: {
      emailNotifications: {
        type: Boolean,
        default: true
      },
      smsNotifications: {
        type: Boolean,
        default: false
      },
      reminderSchedule: [{
        days: Number,
        type: {
          type: String,
          enum: ['registration_reminder', 'payment_reminder', 'event_reminder']
        }
      }]
    }
  },

  // Categories template
  categoriesTemplate: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    price: {
      type: Number,
      default: 0,
      min: 0
    },
    earlyBirdPrice: {
      type: Number,
      min: 0
    },
    capacity: Number,
    isDefault: {
      type: Boolean,
      default: false
    },
    requirements: [String],
    benefits: [String],
    resources: [{
      name: String,
      description: String,
      quantity: Number,
      isOptional: {
        type: Boolean,
        default: false
      }
    }]
  }],

  // Email templates
  emailTemplates: [{
    type: {
      type: String,
      required: true,
      enum: [
        'registration_confirmation',
        'payment_confirmation',
        'event_reminder',
        'abstract_confirmation',
        'review_assignment',
        'certificate_ready',
        'event_cancelled'
      ]
    },
    subject: {
      type: String,
      required: true
    },
    body: {
      type: String,
      required: true
    },
    variables: [String], // Available template variables
    isActive: {
      type: Boolean,
      default: true
    }
  }],

  // Agenda template
  agendaTemplate: {
    sessions: [{
      title: String,
      description: String,
      duration: Number, // minutes
      type: {
        type: String,
        enum: ['keynote', 'presentation', 'workshop', 'panel', 'networking', 'break'],
        default: 'presentation'
      },
      track: String,
      requirements: [String],
      capacity: Number
    }],
    breaks: [{
      title: String,
      duration: Number, // minutes
      type: {
        type: String,
        enum: ['coffee_break', 'lunch', 'networking', 'other'],
        default: 'coffee_break'
      }
    }]
  },

  // Form fields template
  formFieldsTemplate: {
    personalInfo: [{
      name: String,
      label: String,
      type: {
        type: String,
        enum: ['text', 'email', 'phone', 'select', 'checkbox', 'textarea', 'date'],
        default: 'text'
      },
      required: {
        type: Boolean,
        default: false
      },
      options: [String], // For select fields
      validation: {
        pattern: String,
        minLength: Number,
        maxLength: Number
      },
      placeholder: String,
      helpText: String
    }],
    additionalInfo: [{
      name: String,
      label: String,
      type: {
        type: String,
        enum: ['text', 'select', 'checkbox', 'textarea', 'file'],
        default: 'text'
      },
      required: {
        type: Boolean,
        default: false
      },
      options: [String]
    }]
  },

  // Usage statistics
  usageStats: {
    timesUsed: {
      type: Number,
      default: 0
    },
    lastUsed: Date,
    eventsCreated: [{
      eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
      },
      createdAt: Date,
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    averageRating: {
      type: Number,
      min: 1,
      max: 5
    },
    ratings: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  version: {
    type: String,
    default: '1.0.0'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
eventTemplateSchema.index({ name: 'text', description: 'text', tags: 'text' });
eventTemplateSchema.index({ category: 1, isPublic: 1 });
eventTemplateSchema.index({ createdBy: 1, isActive: 1 });
eventTemplateSchema.index({ 'usageStats.timesUsed': -1 });

// Static methods
eventTemplateSchema.statics.getPopularTemplates = async function(limit = 10) {
  return await this.find({ isActive: true, isPublic: true })
    .sort({ 'usageStats.timesUsed': -1, 'usageStats.averageRating': -1 })
    .limit(limit)
    .populate('createdBy', 'name email');
};

eventTemplateSchema.statics.getTemplatesByCategory = async function(category) {
  return await this.find({ 
    category, 
    isActive: true, 
    isPublic: true 
  })
    .sort({ 'usageStats.timesUsed': -1 })
    .populate('createdBy', 'name email');
};

eventTemplateSchema.statics.searchTemplates = async function(query, filters = {}) {
  const searchCriteria = {
    isActive: true,
    ...filters
  };

  if (query) {
    searchCriteria.$text = { $search: query };
  }

  return await this.find(searchCriteria)
    .sort({ score: { $meta: 'textScore' }, 'usageStats.timesUsed': -1 })
    .populate('createdBy', 'name email');
};

// Instance methods
eventTemplateSchema.methods.createEventFromTemplate = async function(eventData, userId) {
  const Event = require('./Event');
  
  // Merge template data with provided event data
  const newEventData = {
    ...this.defaultSettings,
    ...eventData,
    name: eventData.name || this.name,
    description: eventData.description || this.description,
    categories: this.categoriesTemplate.map(cat => ({
      ...cat.toObject(),
      _id: undefined // Let MongoDB generate new IDs
    })),
    emailSettings: {
      templates: this.emailTemplates.filter(t => t.isActive).reduce((acc, template) => {
        acc[template.type] = {
          subject: template.subject,
          body: template.body
        };
        return acc;
      }, {})
    },
    agenda: this.agendaTemplate,
    customFields: this.formFieldsTemplate,
    createdBy: userId,
    createdFromTemplate: this._id
  };

  const newEvent = new Event(newEventData);
  await newEvent.save();

  // Update usage statistics
  this.usageStats.timesUsed += 1;
  this.usageStats.lastUsed = new Date();
  this.usageStats.eventsCreated.push({
    eventId: newEvent._id,
    createdAt: new Date(),
    createdBy: userId
  });

  await this.save();

  return newEvent;
};

eventTemplateSchema.methods.addRating = async function(userId, rating, comment) {
  // Remove existing rating from this user
  this.usageStats.ratings = this.usageStats.ratings.filter(
    r => !r.userId.equals(userId)
  );

  // Add new rating
  this.usageStats.ratings.push({
    userId,
    rating,
    comment,
    createdAt: new Date()
  });

  // Recalculate average rating
  const totalRatings = this.usageStats.ratings.length;
  const sumRatings = this.usageStats.ratings.reduce((sum, r) => sum + r.rating, 0);
  this.usageStats.averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0;

  return await this.save();
};

eventTemplateSchema.methods.clone = async function(newName, userId) {
  const clonedTemplate = new this.constructor(this.toObject());
  clonedTemplate._id = undefined;
  clonedTemplate.name = newName;
  clonedTemplate.createdBy = userId;
  clonedTemplate.usageStats = {
    timesUsed: 0,
    eventsCreated: [],
    ratings: []
  };
  clonedTemplate.isPublic = false; // Cloned templates are private by default

  return await clonedTemplate.save();
};

eventTemplateSchema.methods.export = function() {
  const exported = this.toObject();
  
  // Remove sensitive/system fields
  delete exported._id;
  delete exported.createdBy;
  delete exported.organization;
  delete exported.usageStats;
  delete exported.createdAt;
  delete exported.updatedAt;
  delete exported.__v;

  return exported;
};

// Pre-save middleware
eventTemplateSchema.pre('save', function(next) {
  // Ensure at least one category is marked as default
  if (this.categoriesTemplate && this.categoriesTemplate.length > 0) {
    const hasDefault = this.categoriesTemplate.some(cat => cat.isDefault);
    if (!hasDefault) {
      this.categoriesTemplate[0].isDefault = true;
    }
  }

  next();
});

module.exports = mongoose.model('EventTemplate', eventTemplateSchema);
