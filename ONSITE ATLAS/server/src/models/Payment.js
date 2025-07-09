const mongoose = require('mongoose');
const generateInvoice = require('../services/invoiceService');

/**
 * Payment Schema
 * One document per gateway attempt so we can display granular history.
 * # Reason: decouples money flow from Registration and supports refunds/partial captures.
 */
const paymentSchema = new mongoose.Schema({
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
    index: true,
  },
  registration: {
    type: mongoose.Schema.Types.ObjectId,
      validate: {
        validator: function(id) {
          return mongoose.Types.ObjectId.isValid(id);
        },
        message: 'Invalid ObjectId format'
      },
    ref: 'Registration',
    index: true,
  },
  provider: {
    type: String, trim: true,
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
      'offline',
    ],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
    index: true,
  },
  providerPaymentId: String, // e.g. razorpay_payment_id
  status: {
    type: String, trim: true,
    enum: ['initiated', 'paid', 'failed', 'refunded', 'partial-refund'],
        validate: {
          validator: function(value) {
            return !value || this.schema.path(this.$__.path).enumValues.includes(value);
          },
          message: 'Invalid enum value'
        },
    default: 'initiated',
    index: true,
  },
  amountCents: Number,
  currency: {
    type: String, trim: true,
    default: 'INR',
  },
  feeCents: Number, // Fee reported by gateway, if any
  netCents: Number, // amountCents - feeCents
  method: String, // card, upi, netbanking etc.
  capturedAt: Date, // when money captured (paid/refunded)
  meta: mongoose.Schema.Types.Mixed, // raw gateway response for debugging
  invoiceUrl: String,
}, {
  timestamps: true,
});

// Ensure idempotency – unique per provider payment id
paymentSchema.index({ provider: 1, providerPaymentId: 1 }, { unique: true, sparse: true });

paymentSchema.post('save', async function(doc){
  if(doc.status==='paid' && !doc.invoiceUrl){
    try{
      const Registration = require('./Registration');
      const Event = require('./Event');
      const reg = await Registration.findById(doc.registration);
      const event = await Event.findById(doc.event);
      const path = await generateInvoice({ payment:doc, registration:reg, event });
      doc.invoiceUrl = path.replace(/.*public/,'');
      await doc.save();
      // emit socket
      const io = require('../server').io;
      if(io) io.to(event._id.toString()).emit('payments:update');
    } catch (error) { console.error('Invoice gen error',error); }
  }

  if(doc.status==='paid' && doc.invoiceUrl){
    try{
      const sendEmail = require('../services/emailService').sendPaymentInvoiceEmail;
      if(sendEmail) await sendEmail(doc._id);
    } catch (error) { console.error('Invoice email error',error); }
  }
});

module.exports = mongoose.model('Payment', paymentSchema); 