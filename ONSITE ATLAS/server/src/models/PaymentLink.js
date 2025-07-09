const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * PaymentLink Schema
 * # Reason: allows admins to send a unique checkout URL to attendees (magic link).
 */
const paymentLinkSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true,
  },
  registration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
  },
  provider: {
    type: String,
    required: true,
    enum: [
      'razorpay',
      'instamojo',
      'stripe',
      'phonepe',
      'cashfree',
      'payu',
      'paytm',
      'hdfc',
      'axis',
    ],
  },
  amountCents: Number,
  currency: {
    type: String,
    default: 'INR',
  },
  lineItems: [{ label: String, amountCents: Number }],
  token: {
    type: String,
    unique: true,
    index: true,
  },
  expiresAt: Date,
  redeemedAt: Date,
  status: {
    type: String,
    enum: ['active', 'redeemed', 'expired', 'cancelled'],
    default: 'active',
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Generate secure token before save
paymentLinkSchema.pre('validate', function(next) {
  if (!this.token) {
    this.token = crypto.randomBytes(20).toString('hex');
  }
  next();
});

module.exports = mongoose.model('PaymentLink', paymentLinkSchema); 