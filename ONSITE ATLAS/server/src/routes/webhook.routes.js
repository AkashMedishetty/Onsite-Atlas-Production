const express = require('express');
const router = express.Router({ mergeParams: true });
const providers = require('../services/payments');
const Event = require('../models/Event');

// Middleware to resolve event by host header
async function resolveEvent(req, res, next) {
  const host = req.headers.host?.toLowerCase();
  const event = await Event.findOne({ $or: [{ customDomains: host }, { slug: host.split('.')[0] }] });
  if (!event) return res.status(404).send('Event not found');
  req.event = event;
  next();
}

router.post('/:provider', resolveEvent, express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }), async (req, res) => {
  try {
    if(req.event.paymentConfig?.extra?.paymentsEnabled === false){
      return res.status(403).send('Payments disabled');
    }

    const ProviderCls = providers[req.params.provider];
    if (!ProviderCls) return res.status(400).send('Unknown provider');
    const provider = new ProviderCls(req.event);
    provider.verifyWebhook(req);
    await provider.handleWebhook(req.body);
    // emit socket
    req.app.locals.io.to(req.event._id.toString()).emit('payments:update');
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', err.message);
    res.status(400).send('Webhook error');
  }
});

module.exports = router; 