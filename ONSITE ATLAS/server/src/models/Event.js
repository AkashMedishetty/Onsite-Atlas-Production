const mongoose = require('mongoose');
const validator = require('validator');

const eventSchema = new mongoose.Schema({
  name: {
    type: String, trim: true,
    required: [true, 'Event name is required'],
    trim: true
  },
  description: {
    type: String, trim: true,
    trim: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  venue: {
    name: {
      type: String, trim: true,
      required: [true, 'Venue name is required']
    },
    address: {
      type: String, trim: true,
      required: [true, 'Venue address is required']
    },
    city: {
      type: String, trim: true,
      required: [true, 'City is required']
    },
    state: {
      type: String, trim: true
    },
    country: {
      type: String, trim: true,
      required: [true, 'Country is required']
    },
    zipCode: {
      type: String, trim: true
    }
  },
  logo: {
    type: String, trim: true
  },
  bannerImage: {
    type: String, trim: true
  },
  landingPageUrl: {
    type: String, 
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty
        return /^https?:\/\/.+/.test(v); // Basic URL validation
      },
      message: 'Landing page URL must be a valid HTTP or HTTPS URL'
    }
  },
  registrationSettings: {
    idPrefix: {
      type: String, trim: true,
      default: 'REG'
    },
    startNumber: {
      type: Number,
      default: 1
    },
    isOpen: {
      type: Boolean,
      default: true
    },
    allowOnsite: {
      type: Boolean,
      default: true
    },
    collectPhoneNumber: {
      type: Boolean,
      default: true
    },
    collectOrganization: {
      type: Boolean,
      default: true
    },
    collectAddress: {
      type: Boolean,
      default: false
    },
    collectDietaryRestrictions: {
      type: Boolean,
      default: true
    },
    customFields: [{
      name: {
        type: String, trim: true,
        required: true
      },
      label: {
        type: String, trim: true
      },
      placeholder: {
        type: String, trim: true
      },
      description: {
        type: String, trim: true
      },
      type: {
        type: String, trim: true,
        enum: ['text', 'number', 'date', 'select', 'checkbox'],
        required: true
      },
      options: [String],
      isRequired: {
        type: Boolean,
        default: false
      }
    }],
    fieldOrder: [String],
    visibleFields: [String],
    requiredFields: [String],
    accompanyingPersonFields: [{
      name: {
        type: String, trim: true,
        required: true
      },
      label: {
        type: String, trim: true
      },
      placeholder: {
        type: String, trim: true
      },
      description: {
        type: String, trim: true
      },
      type: {
        type: String, trim: true,
        enum: ['text', 'number', 'date', 'select', 'checkbox'],
        required: true
      },
      options: [String],
      isRequired: {
        type: Boolean,
        default: false
      }
    }]
  },
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'Category'
  }],
  meals: [{
    name: {
      type: String, trim: true,
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    startTime: {
      type: String, trim: true,
      required: true
    },
    endTime: {
      type: String, trim: true,
      required: true
    }
  }],
  kitItems: [{
    name: {
      type: String, trim: true,
      required: true
    },
    quantity: {
      type: Number,
      default: 0
    }
  }],
  certificateTypes: [{
    name: {
      type: String, trim: true,
      required: true
    },
    template: {
      type: String, trim: true
    }
  }],
  abstractSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    isOpen: {
      type: Boolean,
      default: false
    },
    deadline: {
      type: Date
    },
    maxLength: {
      type: Number,
      default: 500
    },
    allowEditing: {
      type: Boolean,
      default: true
    },
    guidelines: {
      type: String, trim: true,
      default: ''
    },
    categories: [{
      name: {
        type: String, trim: true,
        required: true
      },
      description: {
        type: String, trim: true
      },
      subTopics: [{
        name: {
          type: String, trim: true,
          required: true
        },
        description: {
          type: String, trim: true
        }
      }],
      reviewerIds: [{
        type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
        ref: 'User',
        default: []
      }]
    }],
    notifyOnSubmission: {
      type: Boolean,
      default: false
    },
    allowFiles: {
      type: Boolean,
      default: false
    },
    maxFileSize: {
      type: Number,
      default: 5
    }
  },
  badgeSettings: {
    orientation: {
      type: String, trim: true,
      enum: ['portrait', 'landscape'],
      default: 'portrait'
    },
    size: {
      width: {
        type: Number,
        default: 3.5
      },
      height: {
        type: Number,
        default: 5
      }
    },
    unit: {
      type: String, trim: true,
      enum: ['in', 'cm', 'mm'],
      default: 'in'
    },
    showLogo: {
      type: Boolean,
      default: true
    },
    logoPosition: {
      type: String, trim: true,
      default: 'top'
    },
    showQR: {
      type: Boolean,
      default: true
    },
    qrPosition: {
      type: String, trim: true,
      default: 'bottom'
    },
    fields: {
      name: {
        type: Object,
        default: { enabled: true, fontSize: 'large', fontWeight: 'bold' }
      },
      organization: {
        type: Object,
        default: { enabled: true, fontSize: 'medium', fontWeight: 'normal' }
      },
      registrationId: {
        type: Object,
        default: { enabled: true, fontSize: 'medium', fontWeight: 'normal' }
      },
      category: {
        type: Object,
        default: { enabled: true, fontSize: 'small', fontWeight: 'normal' }
      },
      country: {
        type: Object,
        default: { enabled: true, fontSize: 'small', fontWeight: 'normal' }
      },
      qrCode: {
        type: Object,
        default: { enabled: true, fontSize: 'medium', fontWeight: 'normal' }
      }
    },
    fieldConfig: {
      name: {
        fontSize: {
          type: Number,
          default: 18
        },
        fontWeight: {
          type: String, trim: true,
          default: 'bold'
        },
        position: {
          top: {
            type: Number,
            default: 40
          },
          left: {
            type: Number,
            default: 50
          }
        }
      },
      organization: {
        fontSize: {
          type: Number,
          default: 14
        },
        fontWeight: {
          type: String, trim: true,
          default: 'normal'
        },
        position: {
          top: {
            type: Number,
            default: 65
          },
          left: {
            type: Number,
            default: 50
          }
        }
      },
      registrationId: {
        fontSize: {
          type: Number,
          default: 12
        },
        fontWeight: {
          type: String, trim: true,
          default: 'normal'
        },
        position: {
          top: {
            type: Number,
            default: 85
          },
          left: {
            type: Number,
            default: 50
          }
        }
      },
      category: {
        fontSize: {
          type: Number,
          default: 12
        },
        fontWeight: {
          type: String, trim: true,
          default: 'normal'
        },
        position: {
          top: {
            type: Number,
            default: 105
          },
          left: {
            type: Number,
            default: 50
          }
        }
      },
      country: {
        fontSize: {
          type: Number,
          default: 12
        },
        fontWeight: {
          type: String, trim: true,
          default: 'normal'
        },
        position: {
          top: {
            type: Number,
            default: 240
          },
          left: {
            type: Number,
            default: 50
          }
        }
      },
      qrCode: {
        size: {
          type: Number,
          default: 100
        },
        position: {
          top: {
            type: Number,
            default: 135
          },
          left: {
            type: Number,
            default: 100
          }
        }
      }
    },
    colors: {
      background: {
        type: String, trim: true,
        default: '#FFFFFF'
      },
      text: {
        type: String, trim: true,
        default: '#000000'
      },
      accent: {
        type: String, trim: true,
        default: '#3B82F6'
      },
      borderColor: {
        type: String, trim: true,
        default: '#CCCCCC'
      }
    },
    background: {
      type: String, trim: true
    },
    logo: {
      type: String, trim: true
    }
  },
  emailSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    senderName: {
      type: String, trim: true,
      default: 'Event Organizer'
    },
    senderEmail: {
      type: String, trim: true,
      default: 'noreply@example.com'
    },
    replyToEmail: {
      type: String, trim: true
    },
    smtpHost: {
      type: String, trim: true
    },
    smtpPort: {
      type: Number,
      default: 587
    },
    smtpUser: {
      type: String, trim: true
    },
    smtpPassword: {
      type: String, trim: true
    },
    smtpSecure: {
      type: Boolean,
      default: false
    },
    certificateTemplate: {
      type: String, trim: true
    },
    scientificBrochure: {
      type: String, trim: true
    },
    automaticEmails: {
      registrationConfirmation: {
        type: Boolean,
        default: true
      },
      eventReminder: {
        type: Boolean,
        default: false
      },
      certificateDelivery: {
        type: Boolean,
        default: false
      },
      workshopInfo: {
        type: Boolean,
        default: false
      },
      scientificBrochure: {
        type: Boolean,
        default: false
      }
    },
    templates: {
      registration: {
        subject: {
          type: String, trim: true,
          default: 'Registration Confirmation - {{eventName}}'
        },
        body: {
          type: String, trim: true,
          default: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333;background:#f6f6f6;padding:24px 0;">
            <table cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="padding:32px;">
                  <h2 style="margin-top:0;color:#111;">Registration Confirmation</h2>
                  <p>Dear {{firstName}},</p>
                  <p>Thank you for registering for <strong>{{eventName}}</strong>.</p>
                  <p>Your registration ID is <strong>{{registrationId}}</strong>.</p>
                  <p>Please keep this email for your reference. You can use the QR code below at the event for check-in:</p>
                  <div style="text-align:center;margin:24px 0;">[QR_CODE]</div>
                  <table cellpadding="0" cellspacing="0" width="100%" style="background:#f0f0f0;border-radius:6px;">
                    <tr><td style="padding:12px 16px;">
                      <strong>Event Details</strong><br/>
                      <span>Date:</span> {{eventDate}}<br/>
                      <span>Venue:</span> {{eventVenue}}
                    </td></tr>
                  </table>
                  <p style="margin-top:24px;">If you have any questions, please contact us.</p>
                  <p style="margin:0;">Regards,<br/><strong>The Organizing Team</strong></p>
                </td>
              </tr>
            </table>
          </div>`
        }
      },
      reminder: {
        subject: {
          type: String, trim: true,
          default: 'Event Reminder - {{eventName}}'
        },
        body: {
          type: String, trim: true,
          default: 'Dear {{firstName}},\n\nThis is a friendly reminder that {{eventName}} is happening soon.\n\nDate: {{eventDate}}\nVenue: {{eventVenue}}\n\nDon\'t forget to bring your registration QR code for quick check-in.\n\nWe look forward to seeing you there!\n\nRegards,\nThe Organizing Team'
        }
      },
      certificate: {
        subject: {
          type: String, trim: true,
          default: 'Your Certificate for {{eventName}}'
        },
        body: {
          type: String, trim: true,
          default: 'Dear {{firstName}},\n\nThank you for participating in {{eventName}}.\n\nYour certificate of participation is attached to this email.\n\nWe hope you enjoyed the event and look forward to seeing you again!\n\nRegards,\nThe Organizing Team'
        }
      },
      workshop: {
        subject: {
          type: String, trim: true,
          default: 'Workshop Information - {{eventName}}'
        },
        body: {
          type: String, trim: true,
          default: 'Dear {{firstName}},\n\nThank you for registering for the workshop at {{eventName}}.\n\nWorkshop Details:\nTitle: {{workshopTitle}}\nDate: {{workshopDate}}\nTime: {{workshopTime}}\nLocation: {{workshopLocation}}\n\nPlease arrive 15 minutes early for registration.\n\nRegards,\nThe Organizing Team'
        }
      },
      scientificBrochure: {
        subject: {
          type: String, trim: true,
          default: 'Scientific Brochure - {{eventName}}'
        },
        body: {
          type: String, trim: true,
          default: 'Dear {{firstName}},\n\nPlease find attached the scientific brochure for {{eventName}}.\n\nThe brochure contains detailed information about the sessions, speakers, and scientific program.\n\nWe look forward to your participation!\n\nRegards,\nThe Organizing Team'
        }
      },
      abstractSubmission: {
        subject: {
          type: String, trim: true,
          default: 'Abstract Submission Received - {{eventName}}'
        },
        body: {
          type: String, trim: true,
          default: 'Dear {{firstName}},\n\nThank you for submitting your abstract "{{abstractTitle}}" (ID: {{abstractNumber}}) for {{eventName}}. Our review committee will evaluate your submission and notify you of the decision.\n\nRegards,\nThe Organizing Team'
        }
      },
      abstractApproved: {
        subject: {
          type: String, trim: true,
          default: 'Abstract Accepted - {{eventName}}'
        },
        body: {
          type: String, trim: true,
          default: 'Dear {{firstName}},\n\nCongratulations! Your abstract "{{abstractTitle}}" (ID: {{abstractNumber}}) has been accepted for {{eventName}}. Further presentation details will follow shortly.\n\nRegards,\nThe Organizing Team'
        }
      },
      abstractRejected: {
        subject: {
          type: String, trim: true,
          default: 'Abstract Decision - {{eventName}}'
        },
        body: {
          type: String, trim: true,
          default: 'Dear {{firstName}},\n\nWe regret to inform you that your abstract "{{abstractTitle}}" (ID: {{abstractNumber}}) has not been accepted for {{eventName}}.\n\nReason: {{reason}}\n\nThank you for your interest and we encourage you to participate in future events.\n\nRegards,\nThe Organizing Team'
        }
      },
      abstractRevisionRequested: {
        subject: {
          type: String, trim: true,
          default: 'Revision Requested for Your Abstract - {{eventName}}'
        },
        body: {
          type: String, trim: true,
          default: 'Dear {{firstName}},\n\nYour abstract "{{abstractTitle}}" (ID: {{abstractNumber}}) requires revision.\nComments: {{reason}}\nPlease resubmit by {{revisionDeadline}}.\n\nRegards,\nThe Organizing Team'
        }
      },
      authorSignup: {
        subject: {
          type: String, trim: true,
          default: 'Welcome to the {{eventName}} Abstract Portal'
        },
        body: {
          type: String, trim: true,
          default: 'Dear {{firstName}},\n\nThank you for creating an Author account for {{eventName}}. You can now submit and manage your abstracts through the portal.\n\nWe look forward to receiving your submissions!\n\nRegards,\nThe Organizing Team'
        }
      },
      custom: {
        subject: {
          type: String, trim: true,
          default: 'Important Update - {{eventName}}'
        },
        body: {
          type: String, trim: true,
          default: 'Dear {{firstName}},\n\nWe wanted to share an important update regarding {{eventName}}.\n\n[Your custom message here]\n\nIf you have any questions, please don\'t hesitate to contact us.\n\nRegards,\nThe Organizing Team'
        }
      }
    }
  },
  emailHistory: [{
    subject: {
      type: String, trim: true,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    recipients: {
      type: Number,
      default: 0
    },
    sent: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    pending: {
      type: Number,
      default: 0
    },
    status: {
      type: String, trim: true,
      enum: ['pending', 'completed', 'completed_with_errors', 'failed'],
      default: 'pending'
    },
    errors: [{
      email: String,
      error: String,
      errorCode: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    templateUsed: {
      type: String, trim: true,
      enum: ['registration', 'reminder', 'certificate', 'workshop', 'custom', 'abstractSubmission', 'abstractApproved', 'abstractRejected', 'abstractRevisionRequested', 'authorSignup'],
      default: 'custom'
    },
    attachments: [{
      filename: String,
      originalName: String,
      size: Number,
      mimeType: String
    }],
    filters: {
      categories: [String],
      registrationStatus: [String],
      paymentStatus: [String],
      audience: [String],
      specificEmails: [String],
      workshops: [String]
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
      ref: 'User'
    },
    sentByName: String,
    sentByEmail: String,
    deliveryStats: {
      opened: {
        type: Number,
        default: 0
      },
      clicked: {
        type: Number,
        default: 0
      },
      bounced: {
        type: Number,
        default: 0
      },
      unsubscribed: {
        type: Number,
        default: 0
      }
    },
    processingTime: {
      startTime: Date,
      endTime: Date,
      durationMs: Number
    }
  }],
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
  status: {
    type: String, trim: true,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  pricingSettings: {
    currency: {
      type: String, trim: true,
      default: 'USD'
    },
    taxPercentage: {
      type: Number,
      default: 0
    },
    displayTaxSeparately: {
      type: Boolean,
      default: false
    },
    allowPartialPayments: {
      type: Boolean,
      default: false
    },
    autoSwitchPricingTiers: {
      type: Boolean,
      default: true
    },
    discountCodes: [{
      code: {
        type: String, trim: true,
        required: true
      },
      discountType: {
        type: String, trim: true,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
      },
      discountValue: {
        type: Number,
        required: true
      },
      maxUses: {
        type: Number,
        default: null
      },
      usesCount: {
        type: Number,
        default: 0
      },
      validFrom: Date,
      validUntil: Date,
      isActive: {
        type: Boolean,
        default: true
      },
      appliesToWorkshops: {
        type: Boolean,
        default: false
      },
      limitedToCategories: [{
        type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
        ref: 'Category'
      }]
    }]
  },
  eventClients: [{
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'EventClient'
  }],
  paymentConfig: {
    provider: {
      type: String, trim: true,
      enum: ['razorpay','instamojo','stripe','phonepe','cashfree','payu','paytm','hdfc','axis'],
      default: 'razorpay'
    },
    mode: { type: String, trim: true, enum: ['test','live'], default: 'test' },
    credentials: {
      type: Map,
      of: String,
    },
    extra: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    }
  },
  registrationComponents: {
    enabled: {
      type: Boolean,
      default: false
    },
    dailyConfiguration: {
      enabled: {
        type: Boolean,
        default: false
      },
      days: [{
        dayId: {
          type: String, trim: true,
          required: true // e.g., 'day1', 'day2', 'day3'
        },
        name: {
          type: String, trim: true,
          required: true // e.g., 'Day 1', 'Opening Day'
        },
        date: {
          type: Date,
          required: true
        },
        description: String, // e.g., 'Keynotes and networking'
        
        // Component pricing for this day
        componentPricing: [{
          componentType: {
            type: String, trim: true,
            enum: ['daily', 'main-event', 'workshop-addon', 'session-specific', 'virtual-only', 'networking-only'],
            required: true
          },
          audience: String, // e.g., 'member', 'student', 'general'
          category: String, // registration category
          priceCents: {
            type: Number,
            required: true
          },
          currency: {
            type: String, trim: true,
            default: 'INR'
          },
          entitlements: {
            // What this day component includes
            sessions: [String], // Session IDs or names
            meals: {
              breakfast: { type: Boolean, default: false },
              lunch: { type: Boolean, default: false },
              dinner: { type: Boolean, default: false },
              snacks: { type: Boolean, default: false }
            },
            kitItems: [String], // Kit item IDs
            networking: {
              welcomeReception: { type: Boolean, default: false },
              networkingBreaks: { type: Boolean, default: false },
              dinnerBanquet: { type: Boolean, default: false }
            },
            certificates: [String] // Certificate types
          },
          active: {
            type: Boolean,
            default: true
          }
        }],
        
        // Day-specific settings
        maxAttendees: Number,
        requiresMainEvent: {
          type: Boolean,
          default: false // If true, can only be purchased with main event
        },
        active: {
          type: Boolean,
          default: true
        }
      }]
    },
    
    // Workshop component configuration  
    workshopComponents: [{
      workshopId: {
        type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
        ref: 'Workshop',
        required: true
      },
      componentType: {
        type: String, trim: true,
        enum: ['workshop-standalone', 'workshop-addon'],
        default: 'workshop-addon'
      },
      name: {
        type: String, trim: true,
        required: true
      },
      description: String,
      
      // Pricing for different audiences
      pricing: [{
        audience: String, // e.g., 'member', 'student', 'general'
        category: String, // registration category  
        priceCents: {
          type: Number,
          required: true
        },
        currency: {
          type: String, trim: true,
          default: 'INR'
        }
      }],
      
      // Workshop-specific entitlements
      entitlements: {
        materials: [String],
        certificates: [String],
        recordings: { type: Boolean, default: false },
        followUpSessions: { type: Boolean, default: false }
      },
      
      // Prerequisites
      prerequisites: {
        requiresMainEvent: {
          type: Boolean,
          default: false
        },
        requiredDays: [String], // Must have access to these days
        maxPerRegistrant: {
          type: Number,
          default: 1
        }
      },
      
      active: {
        type: Boolean,
        default: true
      }
    }],
    
    // Session-specific components
    sessionComponents: [{
      sessionId: {
        type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
        ref: 'Session'
      },
      name: {
        type: String, trim: true,
        required: true
      },
      description: String,
      
      componentType: {
        type: String, trim: true,
        enum: ['session-specific', 'virtual-only'],
        default: 'session-specific'
      },
      
      pricing: [{
        audience: String,
        category: String,
        priceCents: {
          type: Number,
          required: true
        },
        currency: {
          type: String, trim: true,
          default: 'INR'
        }
      }],
      
      entitlements: {
        liveAccess: { type: Boolean, default: true },
        recording: { type: Boolean, default: false },
        materials: [String],
        qAndA: { type: Boolean, default: true }
      },
      
      active: {
        type: Boolean,
        default: true
      }
    }],
    
    // Package deals (combinations of components)
    packageDeals: [{
      name: {
        type: String, trim: true,
        required: true
      },
      description: String,
      
      // Components included in this package
      includedComponents: [{
        componentType: {
          type: String, trim: true,
          enum: ['main-event', 'daily', 'workshop-standalone', 'workshop-addon', 'session-specific', 'virtual-only'],
          required: true
        },
        componentId: String, // Reference to specific component
        required: {
          type: Boolean,
          default: true
        }
      }],
      
      // Package pricing (usually discounted)
      pricing: [{
        audience: String,
        category: String,
        priceCents: {
          type: Number,
          required: true
        },
        currency: {
          type: String, trim: true,
          default: 'INR'
        },
        discountPercentage: Number // vs individual component prices
      }],
      
      // Package constraints
      constraints: {
        minComponents: {
          type: Number,
          default: 2
        },
        maxComponents: Number,
        validityPeriod: {
          startDate: Date,
          endDate: Date
        }
      },
      
      active: {
        type: Boolean,
        default: true
      }
    }]
  },

  pricingRules: [{
    name: { type: String, trim: true, required: true },
    tier: String,         // e.g. early-bird
    audience: String,     // e.g. member / student / vip
    category: String,     // registration category / role
    startDate: Date,
    endDate: Date,
    priceCents: { type: Number, required: true },
    currency: { type: String, trim: true, default: 'INR' },
    active: { type: Boolean, default: true },
    priority: { type: Number, default: 0 }, // higher wins; lower number first
    exclusive: { type: Boolean, default: false },
  }],

  workshops: [{
    name: { type: String, trim: true, required: true },
    description: String,
    seatLimit: { type: Number, default: 0 },
    priceCents: { type: Number, required: true },
    stripePriceId: String,
    allowedAudiences: [String], // whitelist, empty = open to all
    maxPerMemberType: {
      type: Map,
      of: Number, // audienceKey -> max workshops allowed
      default: undefined,
    },
    active: { type: Boolean, default: true },
  }],

  audienceWorkshopLimit: {
    type: Map,
    of: Number, // audienceKey -> overall max workshops
  },

  settings: {
    payment: {
      defaultLinkExpiryHours: { type: Number, default: 48 }
    }
  },

  accompanyingPersonSettings: {
    maxAllowed: { type: Number, default: 0 },
    feeCents: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Virtual for registration count
eventSchema.virtual('registrationCount', {
  ref: 'Registration',
  localField: '_id',
  foreignField: 'event',
  count: true
});

// Method to check if event is active
eventSchema.methods.isActive = function() {
  const now = new Date();
  return now >= this.startDate && now <= this.endDate;
};

// Method to check if event is upcoming
eventSchema.methods.isUpcoming = function() {
  const now = new Date();
  return now < this.startDate;
};

// Method to check if event is past
eventSchema.methods.isPast = function() {
  const now = new Date();
  return now > this.endDate;
};

// NEW: Component-based pricing methods

// Method to check if component-based registration is enabled
eventSchema.methods.isComponentBasedRegistration = function() {
  return this.registrationComponents && this.registrationComponents.enabled;
};

// Method to get available daily components for a specific audience/category
eventSchema.methods.getAvailableDailyComponents = function(audience, category, date = new Date()) {
  if (!this.isComponentBasedRegistration() || !this.registrationComponents.dailyConfiguration.enabled) {
    return [];
  }
  
  return this.registrationComponents.dailyConfiguration.days
    .filter(day => day.active && day.date >= date)
    .map(day => ({
      dayId: day.dayId,
      name: day.name,
      date: day.date,
      description: day.description,
      pricing: day.componentPricing.filter(price => 
        price.active && 
        (!audience || !price.audience || price.audience === audience) &&
        (!category || !price.category || price.category === category)
      ),
      requiresMainEvent: day.requiresMainEvent,
      maxAttendees: day.maxAttendees
    }));
};

// Method to get available workshop components
eventSchema.methods.getAvailableWorkshopComponents = function(audience, category) {
  if (!this.isComponentBasedRegistration()) {
    return [];
  }
  
  return this.registrationComponents.workshopComponents
    .filter(workshop => workshop.active)
    .map(workshop => ({
      workshopId: workshop.workshopId,
      componentType: workshop.componentType,
      name: workshop.name,
      description: workshop.description,
      pricing: workshop.pricing.filter(price =>
        (!audience || !price.audience || price.audience === audience) &&
        (!category || !price.category || price.category === category)
      ),
      entitlements: workshop.entitlements,
      prerequisites: workshop.prerequisites
    }));
};

// Method to get component price for specific audience/category
eventSchema.methods.getComponentPrice = function(componentType, componentId, audience, category) {
  if (!this.isComponentBasedRegistration()) {
    return null;
  }
  
  let pricing = null;
  
  switch (componentType) {
    case 'daily':
      const day = this.registrationComponents.dailyConfiguration.days
        .find(d => d.dayId === componentId && d.active);
      if (day) {
        pricing = day.componentPricing.find(p => 
          p.active &&
          (!audience || !p.audience || p.audience === audience) &&
          (!category || !p.category || p.category === category)
        );
      }
      break;
      
    case 'workshop-standalone':
    case 'workshop-addon':
      const workshop = this.registrationComponents.workshopComponents
        .find(w => w.workshopId.toString() === componentId && w.active);
      if (workshop) {
        pricing = workshop.pricing.find(p =>
          (!audience || !p.audience || p.audience === audience) &&
          (!category || !p.category || p.category === category)
        );
      }
      break;
      
    case 'session-specific':
    case 'virtual-only':
      const session = this.registrationComponents.sessionComponents
        .find(s => s.sessionId.toString() === componentId && s.active);
      if (session) {
        pricing = session.pricing.find(p =>
          (!audience || !p.audience || p.audience === audience) &&
          (!category || !p.category || p.category === category)
        );
      }
      break;
  }
  
  return pricing ? {
    priceCents: pricing.priceCents,
    currency: pricing.currency || 'INR'
  } : null;
};

// Method to validate component combination (check prerequisites)
eventSchema.methods.validateComponentCombination = function(components) {
  if (!this.isComponentBasedRegistration()) {
    return { valid: true };
  }
  
  const errors = [];
  const hasMainEvent = components.some(c => c.componentType === 'main-event');
  const dayComponents = components.filter(c => c.componentType === 'daily');
  const workshopComponents = components.filter(c => 
    c.componentType === 'workshop-standalone' || c.componentType === 'workshop-addon'
  );
  
  // Check workshop prerequisites
  workshopComponents.forEach(workshopComp => {
    const workshop = this.registrationComponents.workshopComponents
      .find(w => w.workshopId.toString() === workshopComp.componentId);
    
    if (workshop && workshop.prerequisites) {
      if (workshop.prerequisites.requiresMainEvent && !hasMainEvent) {
        errors.push(`Workshop "${workshop.name}" requires main event registration`);
      }
      
      if (workshop.prerequisites.requiredDays && workshop.prerequisites.requiredDays.length > 0) {
        const hasRequiredDays = workshop.prerequisites.requiredDays.every(dayId =>
          dayComponents.some(dc => dc.componentId === dayId)
        );
        if (!hasRequiredDays) {
          errors.push(`Workshop "${workshop.name}" requires access to specific days: ${workshop.prerequisites.requiredDays.join(', ')}`);
        }
      }
    }
  });
  
  // Check day-specific requirements
  dayComponents.forEach(dayComp => {
    const day = this.registrationComponents.dailyConfiguration.days
      .find(d => d.dayId === dayComp.componentId);
    
    if (day && day.requiresMainEvent && !hasMainEvent) {
      errors.push(`Day "${day.name}" requires main event registration`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
};

// Method to calculate total component price with package deals
eventSchema.methods.calculateComponentTotal = function(components, audience, category) {
  if (!this.isComponentBasedRegistration()) {
    return { totalCents: 0, currency: 'INR', breakdown: [] };
  }
  
  // Check for applicable package deals first
  const applicablePackages = this.registrationComponents.packageDeals
    .filter(pkg => pkg.active)
    .filter(pkg => {
      // Check if all required components in package are present
      return pkg.includedComponents
        .filter(ic => ic.required)
        .every(reqComp => 
          components.some(c => 
            c.componentType === reqComp.componentType && 
            (!reqComp.componentId || c.componentId === reqComp.componentId)
          )
        );
    });
  
  // If package deal applies, use package pricing
  if (applicablePackages.length > 0) {
    const bestPackage = applicablePackages[0]; // Use first applicable package
    const packagePrice = bestPackage.pricing.find(p =>
      (!audience || !p.audience || p.audience === audience) &&
      (!category || !p.category || p.category === category)
    );
    
    if (packagePrice) {
      return {
        totalCents: packagePrice.priceCents,
        currency: packagePrice.currency || 'INR',
        breakdown: [{
          type: 'package',
          name: bestPackage.name,
          priceCents: packagePrice.priceCents,
          discountPercentage: packagePrice.discountPercentage
        }],
        appliedPackage: bestPackage.name
      };
    }
  }
  
  // Calculate individual component pricing
  let totalCents = 0;
  const breakdown = [];
  const currency = 'INR'; // Default currency
  
  components.forEach(component => {
    const price = this.getComponentPrice(
      component.componentType, 
      component.componentId, 
      audience, 
      category
    );
    
    if (price) {
      totalCents += price.priceCents;
      breakdown.push({
        type: component.componentType,
        componentId: component.componentId,
        priceCents: price.priceCents,
        currency: price.currency
      });
    }
  });
  
  return {
    totalCents,
    currency,
    breakdown
  };
};

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;