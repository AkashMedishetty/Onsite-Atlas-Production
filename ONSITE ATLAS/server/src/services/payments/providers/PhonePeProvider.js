const axios = require('axios');
const crypto = require('crypto');
const PaymentProvider = require('../PaymentProvider');
const Payment = require('../../../models/Payment');

/**
 * PhonePe Payments – redirect flow using Pay API v4
 * keys stored per event:
 * credentials: { merchantId, saltKey, saltIndex }
 */
class PhonePeProvider extends PaymentProvider {
  constructor(event) {
    super(event);
    this.baseUrl = this.mode === 'live' ? 'https://api.phonepe.com/apis/pg' : 'https://api-preprod.phonepe.com/apis/pg';
  }

  _generateXVerify(payload) {
    const { saltKey, saltIndex } = this.credentials;
    const hash = crypto.createHash('sha256').update(payload + '/pg/v1/pay' + saltKey).digest('hex');
    return `${hash}###${saltIndex}`;
  }

  async createCheckout({ registration, amountCents, successUrl, cancelUrl }) {
    const payload = {
      merchantId: this.credentials.merchantId,
      merchantTransactionId: `reg_${registration._id}`,
      amount: amountCents, // in paise
      merchantUserId: registration._id.toString(),
      redirectUrl: successUrl,
      redirectMode: 'REDIRECT',
      callbackUrl: `${process.env.PUBLIC_URL}/webhooks/phonepe`,
      mobileNumber: registration.phone || '',
      paymentInstrument: { type: 'PAY_PAGE' },
    };
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const headers = {
      'Content-Type': 'application/json',
      'X-VERIFY': this._generateXVerify(base64Payload),
    };
    const resp = await axios.post(`${this.baseUrl}/v1/pay`, { request: base64Payload }, { headers });
    if (resp.data.success !== true) throw new Error('PhonePe error');
    const url = resp.data.data.instrumentResponse.redirectInfo.url;
    await this.logPayment({
      registration: registration._id,
      providerPaymentId: payload.merchantTransactionId,
      amountCents,
      status: 'initiated',
      currency: 'INR',
    });
    return { url };
  }

  verifyWebhook(req) {
    const received = req.headers['x-verify'];
    const bodyStr = JSON.stringify(req.body);
    const calc = crypto.createHash('sha256').update(bodyStr + this.credentials.saltKey).digest('hex');
    if (received !== calc) throw new Error('Invalid PhonePe signature');
  }

  async handleWebhook(body) {
    if (body.code !== 'PAYMENT_SUCCESS') return;
    const txId = body.data.merchantTransactionId;
    await Payment.findOneAndUpdate({ providerPaymentId: txId }, {
      status: 'paid',
      capturedAt: new Date(),
      amountCents: body.data.amount,
      meta: body,
    });
  }
}
module.exports = PhonePeProvider; 