const mongoose = require('mongoose');
const validator = require('validator');

// Component-based registration schema for partial registrations
const registrationComponentSchema = new mongoose.Schema({
  // Component identification
  componentType: {
    type: String, trim: true,
    enum: [
      'main-event',           // Full main event access
      'daily',               // Specific day only (e.g., Day 1, Day 2)
      'workshop-standalone',  // Workshop without main event
      'workshop-addon',      // Workshop add-on for existing attendee
      'session-specific',    // Individual session access
      'virtual-only',        // Virtual attendance only
      'networking-only'      // Networking events only
    ],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
    required: true
  },
  
  // Component details
  name: {
    type: String, trim: true,
    required: true // e.g., "Day 1 Only", "AI Workshop", "Full Event"
  },
  
  description: {
    type: String, trim: true // e.g., "Access to Day 1 sessions and networking"
  },
  
  // Pricing information
  basePrice: {
    cents: { type: Number, default: 0 },
    currency: { type: String, trim: true, default: 'INR' }
  },
  
  finalPrice: {
    cents: { type: Number, default: 0 },
    currency: { type: String, trim: true, default: 'INR' }
  },
  
  // Component-specific configuration
  config: {
    // For daily components
    includedDays: [String], // ['day1', 'day2']
    
    // For workshop components
    workshopId: mongoose.Schema.Types.ObjectId,
    workshopName: String,
    workshopDate: Date,
    workshopDuration: Number, // in minutes
    
    // For session-specific
    includedSessions: [mongoose.Schema.Types.ObjectId],
    
    // Date/time restrictions
    validFrom: Date,
    validUntil: Date,
    
    // Access level
    accessLevel: {
      type: String, trim: true,
      enum: ['full', 'limited', 'view-only'],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
      default: 'full'
    }
  },
  
  // Entitlements provided by this component
  entitlements: {
    // Main event access
    mainEventAccess: {
      type: Boolean,
      default: false
    },
    
    // Daily access
    dayAccess: {
      day1: { type: Boolean, default: false },
      day2: { type: Boolean, default: false },
      day3: { type: Boolean, default: false },
      day4: { type: Boolean, default: false },
      day5: { type: Boolean, default: false }
    },
    
    // Resource entitlements
    meals: {
      breakfast: [String], // ['day1', 'day2']
      lunch: [String],
      dinner: [String],
      snacks: [String]
    },
    
    kitItems: [String], // Kit item IDs this component entitles
    
    certificates: [String], // Certificate types available
    
    // Workshop access
    workshops: [{
      workshopId: mongoose.Schema.Types.ObjectId,
      accessType: {
        type: String, trim: true,
        enum: ['participant', 'observer', 'presenter'],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
        default: 'participant'
      }
    }],
    
    // Session access
    sessions: [{
      sessionId: mongoose.Schema.Types.ObjectId,
      accessType: {
        type: String, trim: true,
        enum: ['full', 'limited', 'view-only'],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
        default: 'full'
      }
    }],
    
    // Networking events
    networking: {
      welcomeReception: { type: Boolean, default: false },
      dinnerBanquet: { type: Boolean, default: false },
      networkingBreaks: { type: Boolean, default: false },
      closingCeremony: { type: Boolean, default: false }
    },
    
    // Digital access
    virtualAccess: {
      liveStreaming: { type: Boolean, default: false },
      recordings: { type: Boolean, default: false },
      presentations: { type: Boolean, default: false },
      digitalResources: { type: Boolean, default: false }
    },
    
    // Badge and printing
    badgeAccess: { type: Boolean, default: true },
    printingAccess: { type: Boolean, default: true }
  },
  
  // Component status
  status: {
    type: String, trim: true,
    enum: ['active', 'cancelled', 'pending', 'expired'],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
    default: 'active'
  },
  
  // Purchase information
  purchaseDate: { type: Date, default: Date.now },
  activationDate: Date,
  expirationDate: Date
}, { _id: true, timestamps: true });

const registrationSchema = new mongoose.Schema({
  registrationId: {
    type: String, trim: true,
    required: true,
    trim: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'Event',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'Category',
    required: true
  },
  
  // NEW: Component-based registration system
  registrationComponents: [registrationComponentSchema],
  
  // NEW: Aggregated entitlements (computed from all components)
  aggregatedEntitlements: {
    // Main event access (derived from components)
    mainEventAccess: { type: Boolean, default: false },
    
    // Daily access (OR of all components)
    dayAccess: {
      day1: { type: Boolean, default: false },
      day2: { type: Boolean, default: false },
      day3: { type: Boolean, default: false },
      day4: { type: Boolean, default: false },
      day5: { type: Boolean, default: false }
    },
    
    // Resource entitlements (union of all components)
    meals: {
      breakfast: [String],
      lunch: [String], 
      dinner: [String],
      snacks: [String]
    },
    
    kitItems: [String],
    certificates: [String],
    
    // Workshop access (union of all components)
    workshops: [{
      workshopId: mongoose.Schema.Types.ObjectId,
      accessType: {
        type: String, trim: true,
        enum: ['participant', 'observer', 'presenter'],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
        default: 'participant'
      }
    }],
    
    // Session access
    sessions: [{
      sessionId: mongoose.Schema.Types.ObjectId,
      accessType: {
        type: String, trim: true,
        enum: ['full', 'limited', 'view-only'],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
        default: 'full'
      }
    }],
    
    // Networking events (OR of all components)
    networking: {
      welcomeReception: { type: Boolean, default: false },
      dinnerBanquet: { type: Boolean, default: false },
      networkingBreaks: { type: Boolean, default: false },
      closingCeremony: { type: Boolean, default: false }
    },
    
    // Digital access (OR of all components)
    virtualAccess: {
      liveStreaming: { type: Boolean, default: false },
      recordings: { type: Boolean, default: false },
      presentations: { type: Boolean, default: false },
      digitalResources: { type: Boolean, default: false }
    },
    
    // Badge and printing (OR of all components)
    badgeAccess: { type: Boolean, default: true },
    printingAccess: { type: Boolean, default: true }
  },
  
  // NEW: Registration type with enhanced options
  registrationType: {
    type: String, trim: true,
    enum: [
      'full-event',          // Traditional full event registration
      'partial-daily',       // One or more specific days
      'workshop-only',       // Workshop(s) without main event
      'hybrid',             // Mix of main event + additional components
      'virtual-only',       // Virtual attendance only
      'pre-registered',     // Legacy - maps to full-event
      'onsite',            // Legacy - maps to full-event
      'imported',          // Legacy - maps to full-event
      'sponsored',         // Legacy - maps to full-event  
      'complementary'      // Legacy - maps to full-event
    ],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
    default: 'full-event'
  },

  personalInfo: {
    firstName: {
      type: String, trim: true,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String, trim: true,
      required: [true, 'Last name is required'],
      trim: true
    },
    email: { type: String, trim: true, required: true,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(email) {
          return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);
        },
        message: 'Please provide a valid email address'
      }
    },
    phone: {
      type: String, trim: true,
      trim: true,
      validate: {
        validator: function(phone) {
          return !phone || /^[+]?[1-9]?[0-9]{7,15}$/.test(phone.replace(/[\s\-()]/g, ''));
        },
        message: 'Please provide a valid phone number'
      }
    },
    organization: {
      type: String, trim: true,
      trim: true
    },
    designation: {
      type: String, trim: true,
      trim: true
    },
    country: {
      type: String, trim: true,
      trim: true
    }
  },
  professionalInfo: {
    mciNumber: { type: String, trim: true },
    membership: { type: String, trim: true }
  },
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  qrCode: {
    type: String, trim: true
  },
  badgePrinted: {
    type: Boolean,
    default: false
  },
  printedBy: {
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'User'
  },
  printedAt: {
    type: Date
  },
  checkIn: {
    isCheckedIn: {
      type: Boolean,
      default: false
    },
    checkedInAt: {
      type: Date
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
      ref: 'User'
    }
  },
  resourceUsage: {
    meals: [{
      meal: {
        type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
        ref: 'Event.meals'
      },
      usedAt: {
        type: Date
      },
      issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
        ref: 'User'
      },
      isVoid: {
        type: Boolean,
        default: false
      },
      voidedBy: {
        type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
        ref: 'User'
      },
      voidedAt: {
        type: Date
      }
    }],
    kitItems: [{
      item: {
        type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
        ref: 'Event.kitItems'
      },
      issuedAt: {
        type: Date
      },
      issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
        ref: 'User'
      },
      isVoid: {
        type: Boolean,
        default: false
      },
      voidedBy: {
        type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
        ref: 'User'
      },
      voidedAt: {
        type: Date
      }
    }],
    certificates: [{
      certificate: {
        type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
        ref: 'Event.certificateTypes'
      },
      issuedAt: {
        type: Date
      },
      issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
        ref: 'User'
      },
      isVoid: {
        type: Boolean,
        default: false
      },
      voidedBy: {
        type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
        ref: 'User'
      },
      voidedAt: {
        type: Date
      }
    }]
  },
  notes: {
    type: String, trim: true
  },
  registeredBy: {
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'User'
  },
  status: {
    type: String, trim: true,
    enum: ['active', 'cancelled', 'no-show'],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
    default: 'active'
  },
  sponsoredBy: {
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'EventSponsor',
    required: false
  },
  
  // Enhanced pricing with component breakdown
  pricing: {
    totalAmount: {
      cents: { type: Number, default: 0 },
      currency: { type: String, trim: true, default: 'INR' }
    },
    componentBreakdown: [{
      componentId: mongoose.Schema.Types.ObjectId,
      name: String,
      amount: {
        cents: { type: Number, default: 0 },
        currency: { type: String, trim: true, default: 'INR' }
      }
    }],
    discounts: [{
      type: String, trim: true, // 'bundle', 'early-bird', 'student', etc.
      amount: {
        cents: { type: Number, default: 0 },
        currency: { type: String, trim: true, default: 'INR' }
      },
      description: String
    }]
  },
  
  // Legacy fields for backward compatibility
  amountCents: {
    type: Number,
    default: 0,
    min: 0,
  },
  currency: {
    type: String, trim: true,
    default: 'INR',
  },
  workshopsSelected: [{
    workshopId: { type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      }, required: true },
    priceCents: { type: Number, required: true },
  }],
  seatHolds: [{
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'SeatHold',
  }],
  paymentStatus: {
    type: String, trim: true,
    enum: ['pending', 'paid', 'failed'],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
    default: 'pending',
  },
  paymentLink: {
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'PaymentLink',
  },
  accompanyingPersons: [{
    firstName: String,
    lastName: String,
    age: Number,
    gender: String,
    badgePrinted: { type: Boolean, default: false },
    customFields: { type: Object, default: {} }
  }]
}, {
  timestamps: true
});

// Method to compute aggregated entitlements from all components
registrationSchema.methods.computeAggregatedEntitlements = function() {
  const entitlements = {
    mainEventAccess: false,
    dayAccess: { day1: false, day2: false, day3: false, day4: false, day5: false },
    meals: { breakfast: [], lunch: [], dinner: [], snacks: [] },
    kitItems: [],
    certificates: [],
    workshops: [],
    sessions: [],
    networking: {
      welcomeReception: false,
      dinnerBanquet: false, 
      networkingBreaks: false,
      closingCeremony: false
    },
    virtualAccess: {
      liveStreaming: false,
      recordings: false,
      presentations: false,
      digitalResources: false
    },
    badgeAccess: false,
    printingAccess: false
  };
  
  // Aggregate entitlements from all active components
  this.registrationComponents.forEach(component => {
    if (component.status === 'active') {
      const compEntitlements = component.entitlements;
      
      // OR boolean fields
      entitlements.mainEventAccess = entitlements.mainEventAccess || compEntitlements.mainEventAccess;
      entitlements.badgeAccess = entitlements.badgeAccess || compEntitlements.badgeAccess;
      entitlements.printingAccess = entitlements.printingAccess || compEntitlements.printingAccess;
      
      // OR day access
      Object.keys(entitlements.dayAccess).forEach(day => {
        entitlements.dayAccess[day] = entitlements.dayAccess[day] || (compEntitlements.dayAccess && compEntitlements.dayAccess[day]);
      });
      
      // Union arrays (remove duplicates)
      if (compEntitlements.meals) {
        ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
          if (compEntitlements.meals[mealType]) {
            entitlements.meals[mealType] = [...new Set([...entitlements.meals[mealType], ...compEntitlements.meals[mealType]])];
          }
        });
      }
      
      if (compEntitlements.kitItems) {
        entitlements.kitItems = [...new Set([...entitlements.kitItems, ...compEntitlements.kitItems])];
      }
      
      if (compEntitlements.certificates) {
        entitlements.certificates = [...new Set([...entitlements.certificates, ...compEntitlements.certificates])];
      }
      
      // Union workshops and sessions (more complex due to objects)
      if (compEntitlements.workshops) {
        compEntitlements.workshops.forEach(workshop => {
          const existing = entitlements.workshops.find(w => w.workshopId.toString() === workshop.workshopId.toString());
          if (!existing) {
            entitlements.workshops.push(workshop);
          } else {
            // Keep highest access level
            const accessLevels = ['observer', 'participant', 'presenter'];
            if (accessLevels.indexOf(workshop.accessType) > accessLevels.indexOf(existing.accessType)) {
              existing.accessType = workshop.accessType;
            }
          }
        });
      }
      
      // OR networking fields
      if (compEntitlements.networking) {
        Object.keys(entitlements.networking).forEach(event => {
          entitlements.networking[event] = entitlements.networking[event] || compEntitlements.networking[event];
        });
      }
      
      // OR virtual access fields
      if (compEntitlements.virtualAccess) {
        Object.keys(entitlements.virtualAccess).forEach(access => {
          entitlements.virtualAccess[access] = entitlements.virtualAccess[access] || compEntitlements.virtualAccess[access];
        });
      }
    }
  });
  
  return entitlements;
};

// Method to update aggregated entitlements (call this after modifying components)
registrationSchema.methods.updateAggregatedEntitlements = function() {
  this.aggregatedEntitlements = this.computeAggregatedEntitlements();
  return this;
};

// Method to check if registration has access to a specific resource
registrationSchema.methods.hasAccess = function(resourceType, resourceId, options = {}) {
  const entitlements = this.aggregatedEntitlements;
  
  switch (resourceType) {
    case 'main-event':
      return entitlements.mainEventAccess;
      
    case 'day':
      return entitlements.dayAccess[resourceId] || false;
      
    case 'meal':
      const { mealType, day } = options;
      return entitlements.meals[mealType] && entitlements.meals[mealType].includes(day);
      
    case 'kit-item':
      return entitlements.kitItems.includes(resourceId);
      
    case 'certificate':
      return entitlements.certificates.includes(resourceId);
      
    case 'workshop':
      return entitlements.workshops.some(w => w.workshopId.toString() === resourceId);
      
    case 'session':
      return entitlements.sessions.some(s => s.sessionId.toString() === resourceId);
      
    case 'networking':
      return entitlements.networking[resourceId] || false;
      
    case 'virtual':
      return entitlements.virtualAccess[resourceId] || false;
      
    default:
      return false;
  }
};

// Pre-save middleware to auto-compute aggregated entitlements
registrationSchema.pre('save', function(next) {
  // Update aggregated entitlements whenever registration is saved
  if (this.isModified('registrationComponents') || this.isNew) {
    this.updateAggregatedEntitlements();
  }
  
  // Generate QR code for new registrations
  if (!this.qrCode && this.isNew) {
    this.qrCode = `https://api.onsite-atlas.com/qr/${this.registrationId}`;
  }
  
  // Sync legacy pricing with new pricing structure
  if (this.pricing && this.pricing.totalAmount) {
    this.amountCents = this.pricing.totalAmount.cents;
    this.currency = this.pricing.totalAmount.currency;
  }
  
  next();
});

// Compound Unique Index for Event + RegistrationId (ensures registrationId is unique per event)
registrationSchema.index({ event: 1, registrationId: 1 }, { unique: true });

// RE-ADD Compound Unique Index for Event + Category + Name (ensures same person isn't registered multiple times in same category/event)
registrationSchema.index(
  {
    event: 1, 
    category: 1, 
    'personalInfo.firstName': 1, 
    'personalInfo.lastName': 1
  }, 
  {
    unique: true,
    background: true,
    // Optional: Add a partial filter index if needed (e.g., only enforce for 'active' status)
    // partialFilterExpression: { status: 'active' } 
  }
);

// Fast lookup for QR code scans
registrationSchema.index({ event: 1, qrCode: 1 });
registrationSchema.index({ event: 1, registrationId: 1 });

// Index for component-based queries
registrationSchema.index({ event: 1, 'registrationComponents.componentType': 1 });
registrationSchema.index({ event: 1, 'registrationComponents.status': 1 });
registrationSchema.index({ event: 1, registrationType: 1 });

const Registration = mongoose.model('Registration', registrationSchema);

module.exports = Registration; 