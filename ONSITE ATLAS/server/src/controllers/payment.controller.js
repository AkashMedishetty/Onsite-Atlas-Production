const PaymentLink = require('../models/PaymentLink');
const whatsappService = require('../services/whatsappService');
const smsService = require('../services/smsService');
const mongoose = require('mongoose');
const createApiError = require('../middleware/error').createApiError;
const { sendSuccess } = require('../utils/responseFormatter');

exports.createPaymentLink = async (req, res, next) => {
  try {
    const eventId = req && req.params && req.params.eventId;
    const Event = require('../models/Event');
    const event = await Event.findById(eventId);
    if (!event) return next(createApiError(404, 'Event not found'));

    // Enforcement: ensure payments are enabled for event
    if(event.paymentConfig?.extra?.paymentsEnabled === false){
      return next(createApiError(403,'Payments are disabled for this event'));
    }

    const { amountCents,
      provider,
      registrationId,
      expiresInHours = event.settings?.payment?.defaultLinkExpiryHours || 48,
      lineItems = [],
     } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };

    if (!amountCents || !provider)
      return next(createApiError(400, 'amountCents & provider required'));

    if (!registrationId)
      return next(createApiError(400, 'registrationId is required – payment links must be tied to a registration'));

    // If category-specific payment requirement configured, enforce
    const Registration = require('../models/Registration');
    const registrationDoc = await Registration.findById(registrationId);
    if (!registrationDoc) return next(createApiError(404,'Registration not found'));

    const catOverrides = event.paymentConfig?.extra?.paymentRequiredCategories || [];
    if(catOverrides.length && !catOverrides.includes(registrationDoc.category?.toString())){
      return next(createApiError(403,'Payment not required for this registration category'));
    }

    const link = await PaymentLink.create({
      event: event._id,
      registration: registrationId || undefined,
      amountCents,
      currency: 'INR',
      provider,
      expiresAt: new Date(Date.now() + expiresInHours * 3600 * 1000),
      lineItems,
      createdBy: req && req.user && req.user._id,
    });
    sendSuccess(res, 201, 'Payment link created', { url: `${process && process.env && process.env.PUBLIC_URL}/pay/${event._id}/${link.token}`, link });
  } catch (error) {
    next(err);
  }
};

exports.listPaymentLinks = async (req, res, next) => {
  try {
    const eventId = req && req.params && req.params.eventId;
    const { page = 1, limit = 20 } = req.query;
    const query = { event: eventId };
    const links = await PaymentLink.find(query).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
    sendSuccess(res, 200, 'Payment links', links);
  } catch (error) {
    next(err);
  }
};

exports.cancelPaymentLink = async (req, res, next) => {
  try {
    const { id, eventId } = req.params;
    if (!mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(id)) return next(createApiError(400, 'Invalid id'));
    const link = await PaymentLink.findOne({ _id: id, event: eventId });
    if (!link) return next(createApiError(404, 'Link not found'));
    link.status = 'cancelled';
    await link.save();
    sendSuccess(res, 200, 'Payment link cancelled', link);
  } catch (error) {
    next(err);
  }
};

// Redeem a payment link and get checkout URL
exports.redeemPaymentLink = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) return next(createApiError(400, 'Token required'));

    const link = await PaymentLink.findOne({ token }).populate('event');
    if (!link) {
      return StandardErrorHandler.sendError(res, 404, 'Resource not found');
    }
    if (!link || link.status !== 'active') {
      return next(createApiError(404, 'Payment link not found or inactive'));
    }

    if (link.expiresAt && link.expiresAt <= new Date()) {
      link.status = 'expired';
      await link.save();
      return next(createApiError(410, 'Payment link expired'));
    }

    const providers = require('../services/payments');
    const ProviderCls = providers[link.provider];
    if (!ProviderCls) return next(createApiError(400, 'Unsupported provider'));

    const provider = new ProviderCls(link.event);
    const Registration = require('../models/Registration');
    let registration = null;
    if (link.registration) {
      registration = await Registration.findById(link.registration);
    }

    const successUrl = `${process && process.env && process.env.PUBLIC_URL}/payment-success/${link && link.event && link.event._id}/${token}`;
    const cancelUrl = `${process && process.env && process.env.PUBLIC_URL}/payment-cancel/${link && link.event && link.event._id}/${token}`;

    const checkout = await provider.createCheckout({
      registration: registration || { _id: link._id, fullName: '', email: '' },
      amountCents: link.amountCents,
      successUrl,
      cancelUrl,
    });

    link.status = 'redeemed';
    link.redeemedAt = new Date();
    await link.save();

    sendSuccess(res, 200, 'Checkout created', { url: checkout.url });
  } catch (error) {
    next(err);
  }
};

// List payments for event
exports.listPayments = async (req, res, next) => {
  try {
    const eventId = req && req.params && req.params.eventId;
    if (!mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(eventId))
      return next(createApiError(400, 'Invalid eventId'));

    const { page = 1, limit = 20, status, provider, search, csv } = req.query;
    const query = { event: eventId };
    if (status) query.status = status;
    if (provider) query.provider = provider;
    if (search) {
      query.$or = [
        { providerPaymentId: { $regex: search, $options: 'i' } },
      ];
    }

    const Payment = require('../models/Payment');
    const paymentsQuery = Payment.find(query)
      .populate('registration', 'registrationId personalInfo.firstName personalInfo.lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const payments = await paymentsQuery;

    if (csv === 'true') {
      // Simple CSV export
      const rows = [
        ['Date', 'Registration', 'Provider', 'Amount', 'Status'].join(','),
        ...payments.map((p) => [
          new Date(p.createdAt).toISOString(),
          p.registration?.registrationId || '',
          p.provider,
          (p.amountCents / 100).toFixed(2),
          p.status,
        ].join(',')),
      ];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payments_${eventId}.csv"`);
      return res.send(rows.join('\n'));
    }

    const total = await Payment.countDocuments(query);
    sendSuccess(res, 200, 'Payments', { payments, total });
  } catch (error) {
    next(err);
  }
};

exports.getPaymentDetail = async (req, res, next) => {
  try {
    const { eventId, paymentId } = req.params;
    if (!mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(eventId) || !mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(paymentId)) {
      return next(createApiError(400, 'Invalid ids'));
    }

    const Payment = require('../models/Payment');
    const payment = await Payment.findOne({ _id: paymentId, event: eventId })
      .populate('registration');
    if (!payment) {
      return StandardErrorHandler.sendError(res, 404, 'Resource not found');
    }
    if (!payment) return next(createApiError(404, 'Payment not found'));
    sendSuccess(res, 200, 'Payment detail', payment);
  } catch (error) {
    next(err);
  }
};

// ------------------------------
// Download invoice PDF
// ------------------------------
exports.downloadInvoice = async (req, res, next) => {
  try {
    const { registrationId } = req.params;
    
    if (!registrationId) {
      return next(createApiError(400, 'Registration ID is required'));
    }

    // Find registration
    const Registration = require('../models/Registration');
    const registration = await Registration.findOne({ registrationId })
      .populate('event', 'name startDate endDate')
      .populate('category', 'name');
      
    if (!registration) {
      return StandardErrorHandler.sendError(res, 404, 'Resource not found');
    }

    // Generate invoice data
    const invoiceData = {
      invoiceNumber: `INV-${registration.registrationId}`,
      registrationId: registration.registrationId,
      registrantName: `${registration.personalInfo?.firstName || ''} ${registration.personalInfo?.lastName || ''}`,
      registrantEmail: registration.personalInfo?.email,
      eventName: registration.event?.name,
      eventDates: `${new Date(registration.event?.startDate).toLocaleDateString()} - ${new Date(registration.event?.endDate).toLocaleDateString()}`,
      category: registration.category?.name,
      amount: registration.amountCents / 100,
      currency: registration.currency || 'INR',
      paymentStatus: registration.paymentStatus,
      registrationDate: registration.createdAt,
      paymentDate: registration.paymentDate || null
    };

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${registration.registrationId}.pdf"`);
    
    // For now, return invoice data as JSON (can be enhanced with PDF generation)
    res.json({
      success: true,
      message: 'Invoice data retrieved successfully',
      data: invoiceData,
      downloadUrl: `/api/payments/invoice/${registrationId}/pdf`
    });

  } catch (error) {
    next(err);
  }
};

exports.createOfflinePayment = async (req,res,next)=>{
  try{
    const { eventId } = req.params;
    const { registrationId, amountCents, method='cash', reference=''  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };
    if(!registrationId || !amountCents) return next(createApiError(400,'registrationId & amountCents required'));
    const Event=require('../models/Event');
    const Registration=require('../models/Registration');
    const event=await Event.findById(eventId);
    if(!event) return next(createApiError(404,'Event not found'));
    const reg=await Registration.findById(registrationId);
    if(!reg) return next(createApiError(404,'Registration not found'));
    const Payment=require('../models/Payment');
    const payment=await Payment.create({
      event:event._id,
      registration:registrationId,
      provider:'offline',
      status:'initiated',
      amountCents,
      currency:'INR',
      method,
      meta:{ reference }
    });
    sendSuccess(res,201,'Offline payment logged',payment);
  } catch (error) { next(err);} };

exports.markPaymentPaid = async(req,res,next)=>{
  try{
    const { eventId, paymentId }=req.params;
    const Payment=require('../models/Payment');
    const payment=await Payment.findOne({ _id:paymentId, event:eventId });
    if(!payment) return next(createApiError(404,'Payment not found'));
    payment.status='paid';
    payment.capturedAt=new Date();
    await payment.save();
    sendSuccess(res,200,'Payment marked as paid',payment);
  } catch (error) { next(err);} };

// Generate payment link for a specific registration
exports.generatePaymentLink = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { registrationId, amount, lineItems  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };

    if (!registrationId) {
      return next(createApiError(400, 'Registration ID is required'));
    }

    // Validate event exists
    const Event = require('../models/Event');
    const event = await Event.findById(eventId);
    if (!event) return next(createApiError(404, 'Event not found'));

    // Validate registration exists
    const Registration = require('../models/Registration');
    const registration = await Registration.findById(registrationId);
    if (!registration) return next(createApiError(404, 'Registration not found'));

    // Use provided amount or calculate from registration
    const amountCents = amount ? Math.round(amount * 100) : (registration.totalAmount || 0) * 100;

    if (amountCents <= 0) {
      return next(createApiError(400, 'Valid payment amount is required'));
    }

    // Create payment link
    const link = await PaymentLink.create({
      event: eventId,
      registration: registrationId,
      amountCents,
      currency: 'INR',
      provider: event.paymentConfig?.defaultProvider || 'razorpay',
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000), // 48 hours
      lineItems: lineItems || [],
      createdBy: req && req.user && req.user._id,
    });

    const paymentUrl = `${process && process.env && process.env.PUBLIC_URL || 'http://localhost:3000'}/pay/${event._id}/${link.token}`;

    sendSuccess(res, 201, 'Payment link generated successfully', {
      url: paymentUrl,
      link: {
        id: link._id,
        token: link.token,
        amount: amountCents / 100,
        expiresAt: link.expiresAt,
        status: link.status
      }
    });
  } catch (error) {
    next(err);
  }
};

// Bulk payment links with WhatsApp/SMS sending
exports.sendBulkPaymentLinks = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { registrationIds, method, customMessage  } = req.body || {};
  if (!req.body) {
    return StandardErrorHandler.sendError(res, 400, 'Request body is required');
  };

    if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
      return next(createApiError(400, 'registrationIds array is required'));
    }

    if (!['email', 'sms', 'whatsapp'].includes(method)) {
      return next(createApiError(400, 'method must be email, sms, or whatsapp'));
    }

    const Event = require('../models/Event');
    const Registration = require('../models/Registration');

    const event = await Event.findById(eventId);
    if (!event) return next(createApiError(404, 'Event not found'));

    // Get registrations with pending payments
    const registrations = await Registration.find({
      _id: { $in: registrationIds },
      event: eventId,
      paymentStatus: { $in: ['pending', 'partial'] }
    }).populate('category', 'name basePrice');

    if (registrations.length === 0) {
      return next(createApiError(400, 'No registrations with pending payments found'));
    }

    const results = [];

    for (const registration of registrations) {
      try {
        // Generate payment link
        const amountCents = registration.amountCents || (registration.category?.basePrice * 100) || 0;
        
        const paymentLink = await PaymentLink.create({
          event: eventId,
          registration: registration._id,
          amountCents,
          currency: 'INR',
          provider: 'razorpay', // default provider
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000), // 48 hours
          createdBy: req && req.user && req.user._id,
        });

        const paymentUrl = `${process && process.env && process.env.PUBLIC_URL}/pay/${eventId}/${paymentLink.token}`;

        let sendResult;
        
        if (method === 'whatsapp') {
          sendResult = await whatsappService.sendPaymentLink(
            registration.personalInfo?.phone,
            {
              ...registration.toObject(),
              event: event.toObject()
            },
            paymentUrl
          );
        } else if (method === 'sms') {
          sendResult = await smsService.sendPaymentLink(
            registration.personalInfo?.phone,
            {
              ...registration.toObject(),
              event: event.toObject()
            },
            paymentUrl
          );
        } else if (method === 'email') {
          // Email implementation would go here
          sendResult = { success: true, message: 'Email sending not implemented yet' };
        }

        results.push({
          registrationId: registration.registrationId,
          registrationDbId: registration._id,
          success: sendResult.success,
          message: sendResult.message,
          paymentLink: paymentUrl,
          phoneNumber: registration.personalInfo?.phone
        });

      } catch (error) {
        results.push({
          registrationId: registration.registrationId,
          registrationDbId: registration._id,
          success: false,
          message: error.message,
          phoneNumber: registration.personalInfo?.phone
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results && results.length - successCount;

    sendSuccess(res, 200, `Bulk payment links sent via ${method}`, {
      summary: {
        total: results && results.length,
        successful: successCount,
        failed: failureCount,
        method
      },
      results
    });

  } catch (error) {
    next(err);
  }
}; 