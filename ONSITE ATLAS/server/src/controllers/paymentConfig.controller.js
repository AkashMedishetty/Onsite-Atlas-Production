const Event = require('../models/Event');
const { createApiError } = require('../middleware/error');
const { sendSuccess } = require('../utils/responseFormatter');
const AuditLog = require('../models/AuditLog');

exports.getPaymentConfig = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).select('paymentConfig');
    if (!event) return next(createApiError(404, 'Event not found'));
    sendSuccess(res, 200, 'Payment config', event.paymentConfig || {});
  } catch (error) {
    next(err);
  }
};

exports.updatePaymentConfig = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { provider, mode, credentials = {}, extra = {} } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return next(createApiError(404, 'Event not found'));
    // capture before snapshot
    const before = event.paymentConfig ? JSON.parse(JSON.stringify(event.paymentConfig)) : {};
    if (provider) event.paymentConfig.provider = provider;
    if (mode) event.paymentConfig.mode = mode;
    if (credentials) event.paymentConfig.credentials = credentials;
    if (extra) event.paymentConfig.extra = extra;
    await event.save();
    // capture after snapshot
    const after = event.paymentConfig ? JSON.parse(JSON.stringify(event.paymentConfig)) : {};
    await AuditLog.create({ event: event._id, user: req.user._id, action: 'paymentConfig.update', before, after });
    sendSuccess(res, 200, 'Payment config updated', event.paymentConfig);
  } catch (error) {
    next(err);
  }
};

exports.getPaymentStatus = async (req,res,next)=>{
  try{
    const {eventId}=req.params;
    const event = await Event.findById(eventId).select('paymentConfig');
    if(!event) return next(createApiError(404,'Event not found'));
    const cfg=event.paymentConfig||{};
    const enabled = cfg.extra?.paymentsEnabled !== false;
    res.json({ paymentsEnabled: enabled, paymentRequired: cfg.extra?.paymentRequired !== false, provider: cfg.provider, mode: cfg.mode });
  } catch (error) { next(err);} }; 