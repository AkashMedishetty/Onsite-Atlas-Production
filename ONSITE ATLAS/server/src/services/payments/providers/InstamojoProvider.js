const axios = require('axios');
const crypto = require('crypto');
const PaymentProvider = require('../PaymentProvider');
const Payment = require('../../../models/Payment');

class InstamojoProvider extends PaymentProvider {
  constructor(event) {
    super(event);
    this.baseUrl = this.mode === 'live' ? 'https://api.instamojo.com' : 'https://test.instamojo.com';
  }

  async createCheckout({ registration, amountCents, successUrl }) {
    const headers = {
      'X-Api-Key': this.credentials.apiKey,
      'X-Auth-Token': this.credentials.authToken,
      'Content-Type': 'application/json',
    };
    const payload = {
      purpose: `Registration ${registration._id}`,
      amount: (amountCents / 100).toFixed(2),
      buyer_name: registration.fullName,
      email: registration.email,
      redirect_url: successUrl,
      webhook: `${process.env.PUBLIC_URL}/webhooks/instamojo`,
      allow_repeated_payments: false,
    };
    const resp = await axios.post(`${this.baseUrl}/v2/payment_requests/`, payload, { headers });
    await this.logPayment({
      registration: registration._id,
      providerPaymentId: resp.data.id,
      amountCents,
      status: 'initiated',
      currency: 'INR',
    });
    return { url: resp.data.longurl };
  }

  verifyWebhook(req) {
    const signature = req.headers['x-instamojo-signature'];
    const bodyString = req.rawBody || JSON.stringify(req.body);
    const expected = crypto.createHmac('sha1', this.credentials.hmacSalt).update(bodyString).digest('base64');
    if (signature !== expected) throw new Error('Invalid Instamojo signature');
  }

  async handleWebhook(body) {
    if (body.status !== 'Credit') return;
    await Payment.findOneAndUpdate({ providerPaymentId: body.payment_id }, {
      status: 'paid',
      capturedAt: new Date(body.created_at),
      amountCents: Math.round(parseFloat(body.amount) * 100),
      netCents: Math.round(parseFloat(body.amount) * 100),
      meta: body,
    });

    const paymentDoc = await Payment.findOne({ providerPaymentId: body.payment_id });
    if (paymentDoc && paymentDoc.registration) {
      const Registration = require('../../../models/Registration');
      await Registration.findByIdAndUpdate(paymentDoc.registration, { paymentStatus: 'paid', amountCents: paymentDoc.amountCents });
    }
  }
}
module.exports = InstamojoProvider; 