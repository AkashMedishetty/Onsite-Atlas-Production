const axios = require('axios');
const crypto = require('crypto');
const PaymentProvider = require('../PaymentProvider');
const Payment = require('../../../models/Payment');

/**
 * Cashfree Payments (redirect) – uses Order API v2
 * credentials: { appId, secretKey }
 */
class CashfreeProvider extends PaymentProvider {
  constructor(event) {
    super(event);
    this.baseUrl = this.mode === 'live' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
  }

  _headers(body) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = crypto.createHmac('sha256', this.credentials.secretKey).update(JSON.stringify(body)).digest('base64');
    return {
      'Content-Type': 'application/json',
      'x-client-id': this.credentials.appId,
      'x-client-secret': this.credentials.secretKey,
      'x-api-version': '2022-09-01',
    };
  }

  async createCheckout({ registration, amountCents, successUrl, cancelUrl }) {
    const orderId = `reg_${registration._id}`;
    const body = {
      order_id: orderId,
      order_amount: (amountCents/100),
      order_currency: 'INR',
      customer_details: {
        customer_id: registration._id.toString(),
        customer_email: registration.email,
        customer_phone: registration.phone || '9999999999',
      },
      order_meta: {
        return_url: successUrl,
        notify_url: `${process.env.PUBLIC_URL}/webhooks/cashfree`,
      },
    };
    const resp = await axios.post(`${this.baseUrl}/orders`, body, { headers: this._headers(body) });
    const paymentLink = resp.data.payment_link;
    await this.logPayment({
      registration: registration._id,
      providerPaymentId: orderId,
      amountCents,
      status: 'initiated',
      currency: 'INR',
    });
    return { url: paymentLink };
  }

  verifyWebhook(req) {
    const signature = req.headers['x-cf-signature'];
    const bodyStr = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', this.credentials.secretKey).update(bodyStr).digest('base64');
    if (signature !== expected) throw new Error('Invalid Cashfree signature');
  }

  async handleWebhook(body) {
    if (body.event !== 'PAYMENT_SUCCESS') return;
    await Payment.findOneAndUpdate({ providerPaymentId: body.data.order.order_id }, {
      status: 'paid',
      capturedAt: new Date(),
      amountCents: Math.round(parseFloat(body.data.order.order_amount)*100),
      meta: body,
    });
  }
}
module.exports = CashfreeProvider; 