const Razorpay = require('razorpay');
const PaymentProvider = require('../PaymentProvider');
const Payment = require('../../../models/Payment');

class RazorpayProvider extends PaymentProvider {
  constructor(event) {
    super(event);
    this.rzp = new Razorpay({ key_id: this.credentials.keyId, key_secret: this.credentials.keySecret });
  }

  async createCheckout({ registration, amountCents, successUrl, cancelUrl }) {
    const order = await this.rzp.orders.create({
      amount: amountCents, // in paise
      currency: 'INR',
      receipt: `reg_${registration._id}`,
      payment_capture: 1,
    });
    await this.logPayment({
      registration: registration._id,
      providerPaymentId: order.id,
      amountCents,
      status: 'initiated',
      currency: 'INR',
    });
    return { url: `${process.env.PUBLIC_URL}/razorpay/checkout?order_id=${order.id}&success=${encodeURIComponent(successUrl)}&cancel=${encodeURIComponent(cancelUrl)}` };
  }

  verifyWebhook(req) {
    const crypto = require('crypto');
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;
    const expected = crypto.createHmac('sha256', this.credentials.webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');
    if (signature !== expected) throw new Error('Invalid Razorpay signature');
  }

  async handleWebhook(body) {
    if (body.event !== 'payment.captured') return;
    const paymentId = body.payload.payment.entity.id;
    const amount   = body.payload.payment.entity.amount; // paise
    await Payment.findOneAndUpdate({ providerPaymentId: paymentId }, {
      status: 'paid',
      capturedAt: new Date(),
      feeCents: body.payload.payment.entity.fee || 0,
      amountCents: amount,
      netCents: amount - (body.payload.payment.entity.fee || 0),
      method: body.payload.payment.entity.method,
      meta: body,
    });

    // Update linked registration if exists
    const paymentDoc = await Payment.findOne({ providerPaymentId: paymentId });
    if (paymentDoc && paymentDoc.registration) {
      const Registration = require('../../../models/Registration');
      await Registration.findByIdAndUpdate(paymentDoc.registration, { paymentStatus: 'paid', amountCents: paymentDoc.amountCents });
    }
  }
}
module.exports = RazorpayProvider; 