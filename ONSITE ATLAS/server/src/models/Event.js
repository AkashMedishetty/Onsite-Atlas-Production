const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Event name is required'],
    trim: true
  },
  description: {
    type: String,
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
      type: String,
      required: [true, 'Venue name is required']
    },
    address: {
      type: String,
      required: [true, 'Venue address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String
    },
    country: {
      type: String,
      required: [true, 'Country is required']
    },
    zipCode: {
      type: String
    }
  },
  logo: {
    type: String
  },
  bannerImage: {
    type: String
  },
  registrationSettings: {
    idPrefix: {
      type: String,
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
        type: String,
        required: true
      },
      label: {
        type: String
      },
      placeholder: {
        type: String
      },
      description: {
        type: String
      },
      type: {
        type: String,
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
    requiredFields: [String]
  },
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  meals: [{
    name: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    }
  }],
  kitItems: [{
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      default: 0
    }
  }],
  certificateTypes: [{
    name: {
      type: String,
      required: true
    },
    template: {
      type: String
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
      type: String,
      default: ''
    },
    categories: [{
      name: {
        type: String,
        required: true
      },
      description: {
        type: String
      },
      subTopics: [{
        name: {
          type: String,
          required: true
        },
        description: {
          type: String
        }
      }],
      reviewerIds: [{
        type: mongoose.Schema.Types.ObjectId,
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
      type: String,
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
      type: String,
      enum: ['in', 'cm', 'mm'],
      default: 'in'
    },
    showLogo: {
      type: Boolean,
      default: true
    },
    logoPosition: {
      type: String,
      default: 'top'
    },
    showQR: {
      type: Boolean,
      default: true
    },
    qrPosition: {
      type: String,
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
          type: String,
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
          type: String,
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
          type: String,
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
          type: String,
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
          type: String,
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
        type: String,
        default: '#FFFFFF'
      },
      text: {
        type: String,
        default: '#000000'
      },
      accent: {
        type: String,
        default: '#3B82F6'
      },
      borderColor: {
        type: String,
        default: '#CCCCCC'
      }
    },
    background: {
      type: String
    },
    logo: {
      type: String
    }
  },
  emailSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    senderName: {
      type: String,
      default: 'Event Organizer'
    },
    senderEmail: {
      type: String,
      default: 'noreply@example.com'
    },
    replyToEmail: {
      type: String
    },
    smtpHost: {
      type: String
    },
    smtpPort: {
      type: Number,
      default: 587
    },
    smtpUser: {
      type: String
    },
    smtpPassword: {
      type: String
    },
    smtpSecure: {
      type: Boolean,
      default: false
    },
    certificateTemplate: {
      type: String
    },
    scientificBrochure: {
      type: String
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
          type: String,
          default: 'Registration Confirmation - {{eventName}}'
        },
        body: {
          type: String,
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
          type: String,
          default: 'Event Reminder - {{eventName}}'
        },
        body: {
          type: String,
          default: 'Dear {{firstName}},\n\nThis is a friendly reminder that {{eventName}} is happening soon.\n\nDate: {{eventDate}}\nVenue: {{eventVenue}}\n\nDon\'t forget to bring your registration QR code for quick check-in.\n\nWe look forward to seeing you there!\n\nRegards,\nThe Organizing Team'
        }
      },
      certificate: {
        subject: {
          type: String,
          default: 'Your Certificate for {{eventName}}'
        },
        body: {
          type: String,
          default: 'Dear {{firstName}},\n\nThank you for participating in {{eventName}}.\n\nYour certificate of participation is attached to this email.\n\nWe hope you enjoyed the event and look forward to seeing you again!\n\nRegards,\nThe Organizing Team'
        }
      },
      workshop: {
        subject: {
          type: String,
          default: 'Workshop Information - {{eventName}}'
        },
        body: {
          type: String,
          default: 'Dear {{firstName}},\n\nThank you for registering for the workshop at {{eventName}}.\n\nWorkshop Details:\nTitle: {{workshopTitle}}\nDate: {{workshopDate}}\nTime: {{workshopTime}}\nLocation: {{workshopLocation}}\n\nPlease arrive 15 minutes early for registration.\n\nRegards,\nThe Organizing Team'
        }
      },
      scientificBrochure: {
        subject: {
          type: String,
          default: 'Scientific Brochure - {{eventName}}'
        },
        body: {
          type: String,
          default: 'Dear {{firstName}},\n\nPlease find attached the scientific brochure for {{eventName}}.\n\nThe brochure contains detailed information about the sessions, speakers, and scientific program.\n\nWe look forward to your participation!\n\nRegards,\nThe Organizing Team'
        }
      },
      abstractSubmission: {
        subject: {
          type: String,
          default: 'Abstract Submission Received - {{eventName}}'
        },
        body: {
          type: String,
          default: 'Dear {{firstName}},\n\nThank you for submitting your abstract "{{abstractTitle}}" (ID: {{abstractNumber}}) for {{eventName}}. Our review committee will evaluate your submission and notify you of the decision.\n\nRegards,\nThe Organizing Team'
        }
      },
      abstractApproved: {
        subject: {
          type: String,
          default: 'Abstract Accepted - {{eventName}}'
        },
        body: {
          type: String,
          default: 'Dear {{firstName}},\n\nCongratulations! Your abstract "{{abstractTitle}}" (ID: {{abstractNumber}}) has been accepted for {{eventName}}. Further presentation details will follow shortly.\n\nRegards,\nThe Organizing Team'
        }
      },
      abstractRejected: {
        subject: {
          type: String,
          default: 'Abstract Decision - {{eventName}}'
        },
        body: {
          type: String,
          default: 'Dear {{firstName}},\n\nWe regret to inform you that your abstract "{{abstractTitle}}" (ID: {{abstractNumber}}) has not been accepted for {{eventName}}.\n\nReason: {{reason}}\n\nThank you for your interest and we encourage you to participate in future events.\n\nRegards,\nThe Organizing Team'
        }
      },
      abstractRevisionRequested: {
        subject: {
          type: String,
          default: 'Revision Requested for Your Abstract - {{eventName}}'
        },
        body: {
          type: String,
          default: 'Dear {{firstName}},\n\nYour abstract "{{abstractTitle}}" (ID: {{abstractNumber}}) requires revision.\nComments: {{reason}}\nPlease resubmit by {{revisionDeadline}}.\n\nRegards,\nThe Organizing Team'
        }
      },
      authorSignup: {
        subject: {
          type: String,
          default: 'Welcome to the {{eventName}} Abstract Portal'
        },
        body: {
          type: String,
          default: 'Dear {{firstName}},\n\nThank you for creating an Author account for {{eventName}}. You can now submit and manage your abstracts through the portal.\n\nWe look forward to receiving your submissions!\n\nRegards,\nThe Organizing Team'
        }
      },
      custom: {
        subject: {
          type: String,
          default: 'Important Update - {{eventName}}'
        },
        body: {
          type: String,
          default: 'Dear {{firstName}},\n\nWe wanted to share an important update regarding {{eventName}}.\n\n[Your custom message here]\n\nIf you have any questions, please don\'t hesitate to contact us.\n\nRegards,\nThe Organizing Team'
        }
      }
    }
  },
  emailHistory: [{
    subject: {
      type: String,
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
    successCount: {
      type: Number,
      default: 0
    },
    failedCount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed'
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  pricingSettings: {
    currency: {
      type: String,
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
        type: String,
        required: true
      },
      discountType: {
        type: String,
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
        ref: 'Category'
      }]
    }]
  },
  eventClients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EventClient'
  }]
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

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;