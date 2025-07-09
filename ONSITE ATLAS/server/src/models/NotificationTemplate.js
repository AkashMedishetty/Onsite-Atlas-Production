const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'registration_confirmation',
      'payment_confirmation',
      'payment_reminder',
      'event_reminder',
      'abstract_confirmation',
      'abstract_review_assigned',
      'review_reminder',
      'decision_notification',
      'certificate_ready',
      'announcement',
      'invoice_generated',
      'final_notice',
      'cancellation_notice'
    ]
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  channel: {
    type: String,
    required: true,
    enum: ['email', 'sms', 'whatsapp', 'inApp', 'push']
  },
  subject: {
    type: String,
    required: function() {
      return this.channel === 'email';
    }
  },
  html: {
    type: String,
    required: function() {
      return this.channel === 'email';
    }
  },
  text: {
    type: String,
    required: true
  },
  variables: [{
    name: String,
    description: String,
    required: {
      type: Boolean,
      default: false
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  language: {
    type: String,
    default: 'en'
  },
  priority: {
    type: String,
    enum: ['critical', 'high', 'normal', 'low'],
    default: 'normal'
  },
  attachments: [{
    filename: String,
    path: String,
    contentType: String
  }],
  metadata: {
    openTracking: {
      type: Boolean,
      default: true
    },
    clickTracking: {
      type: Boolean,
      default: true
    },
    bounceTracking: {
      type: Boolean,
      default: true
    }
  },
  version: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient querying
notificationTemplateSchema.index({ type: 1, eventId: 1, channel: 1 });
notificationTemplateSchema.index({ eventId: 1, isActive: 1 });

// Create default templates when event is created
notificationTemplateSchema.statics.createDefaultTemplates = async function(eventId, createdBy) {
  const defaultTemplates = [
    {
      type: 'registration_confirmation',
      channel: 'email',
      subject: 'Registration Confirmed - {{eventName}}',
      html: `
        <h2>Registration Confirmed</h2>
        <p>Dear {{participantName}},</p>
        <p>Your registration for <strong>{{eventName}}</strong> has been confirmed.</p>
        <p><strong>Registration ID:</strong> {{registrationId}}</p>
        <p><strong>Category:</strong> {{categoryName}}</p>
        <p><strong>Event Date:</strong> {{eventDate}}</p>
        <p>Thank you for registering!</p>
      `,
      text: 'Dear {{participantName}}, Your registration for {{eventName}} has been confirmed. Registration ID: {{registrationId}}',
      variables: [
        { name: 'participantName', description: 'Name of the participant', required: true },
        { name: 'eventName', description: 'Name of the event', required: true },
        { name: 'registrationId', description: 'Registration ID', required: true },
        { name: 'categoryName', description: 'Registration category', required: false },
        { name: 'eventDate', description: 'Event date', required: false }
      ]
    },
    {
      type: 'payment_confirmation',
      channel: 'email',
      subject: 'Payment Received - {{eventName}}',
      html: `
        <h2>Payment Confirmed</h2>
        <p>Dear {{participantName}},</p>
        <p>We have received your payment for <strong>{{eventName}}</strong>.</p>
        <p><strong>Amount:</strong> {{amount}}</p>
        <p><strong>Transaction ID:</strong> {{transactionId}}</p>
        <p><strong>Payment Date:</strong> {{paymentDate}}</p>
        <p>Your registration is now complete!</p>
      `,
      text: 'Dear {{participantName}}, Payment of {{amount}} received for {{eventName}}. Transaction ID: {{transactionId}}'
    },
    {
      type: 'event_reminder',
      channel: 'email',
      subject: 'Event Reminder - {{eventName}}',
      html: `
        <h2>Event Reminder</h2>
        <p>Dear {{participantName}},</p>
        <p>This is a reminder that <strong>{{eventName}}</strong> is starting soon!</p>
        <p><strong>Event Date:</strong> {{eventDate}}</p>
        <p><strong>Venue:</strong> {{venue}}</p>
        <p>We look forward to seeing you there!</p>
      `,
      text: 'Reminder: {{eventName}} is starting soon on {{eventDate}} at {{venue}}'
    }
  ];

  const templates = defaultTemplates.map(template => ({
    ...template,
    eventId,
    createdBy
  }));

  return await this.insertMany(templates);
};

module.exports = mongoose.model('NotificationTemplate', notificationTemplateSchema);
