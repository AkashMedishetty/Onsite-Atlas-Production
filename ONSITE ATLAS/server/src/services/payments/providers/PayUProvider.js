const axios = require('axios');
const crypto = require('crypto');
const PaymentProvider = require('../PaymentProvider');
const Payment = require('../../../models/Payment');

/*
 PayU Biz – REST v2_1 (recommended)
 credentials: { merchantKey, merchantSalt, authHeader }  // authHeader is Base64 key:salt
*/
class PayUProvider extends PaymentProvider {
  constructor(event) {
    super(event);
    this.baseUrl = this.mode === 'live' ? 'https://secure.payu.in' : 'https://sandbox.payu.in';
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${this.credentials.authHeader}`,
    };
  }

  _hash(body) {
    // Simplified hash for checksum – txnid|amount|productinfo|firstname|email|salt
    const str = [body.txnid, body.amount, body.productinfo, body.firstname, body.email, this.credentials.merchantSalt].join('|');
    return crypto.createHash('sha512').update(str).digest('hex');
  }

  async createCheckout({ registration, amountCents, successUrl, cancelUrl }) {
    const txnId = `reg_${registration._id}`;
    const body = {
      txnid: txnId,
      amount: (amountCents / 100).toFixed(2),
      currency: 'INR',
      productinfo: 'Event Registration',
      firstname: registration.personalInfo?.firstName || 'N/A',
      email: registration.personalInfo?.email || registration.email,
      phone: registration.personalInfo?.phone || '9999999999',
      surl: successUrl,
      furl: cancelUrl,
      hash: '', // to be filled
      merchantKey: this.credentials.merchantKey,
    };
    body.hash = this._hash(body);
    const resp = await axios.post(`${this.baseUrl}/api/v2_1/orders`, body, { headers: this._headers() });
    if (!resp.data || !resp.data.redirectUrl) throw new Error('PayU order creation failed');

    await this.logPayment({
      registration: registration._id,
      providerPaymentId: txnId,
      amountCents,
      status: 'initiated',
      currency: 'INR',
    });

    return { url: resp.data.redirectUrl };
  }

  verifyWebhook(req) {
    // PayU sends POST with key=value pairs and hash.
    const { hash } = req.body;
    const posted = req.body;
    const hashSequence = [
      this.credentials.merchantSalt,
      posted.status,
      posted.udf5 || '',
      posted.udf4 || '',
      posted.udf3 || '',
      posted.udf2 || '',
      posted.udf1 || '',
      posted.email,
      posted.firstname,
      posted.productinfo,
      posted.amount,
      posted.txnid,
      this.credentials.merchantKey,
    ].join('|');
    const expected = crypto.createHash('sha512').update(hashSequence).digest('hex');
    if (expected !== hash) throw new Error('Invalid PayU hash');
  }

  async handleWebhook(body) {
    if (body.status !== 'success') return;
    await Payment.findOneAndUpdate({ providerPaymentId: body.txnid }, {
      status: 'paid',
      capturedAt: new Date(),
      amountCents: Math.round(parseFloat(body.amount) * 100),
      method: body.mode,
      meta: body,
    });
  }
}
module.exports = PayUProvider; 