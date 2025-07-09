const axios = require('axios');
const crypto = require('crypto');
const PaymentProvider = require('../PaymentProvider');
const Payment = require('../../../models/Payment');

/*
 Paytm PG v3 Orders API
 credentials: { mid, key }
*/
class PaytmProvider extends PaymentProvider {
  constructor(event) {
    super(event);
    this.baseUrl = this.mode === 'live' ? 'https://secure.paytm.in' : 'https://securegw-stage.paytm.in';
  }

  _checksum(body) {
    const str = JSON.stringify(body) + this.credentials.key;
    return crypto.createHash('sha256').update(str).digest('base64');
  }

  async createCheckout({ registration, amountCents, successUrl, cancelUrl }) {
    const orderId = `REG_${registration._id}`;
    const payload = {
      requestType: 'Payment',
      mid: this.credentials.mid,
      websiteName: 'WEBSTAGING',
      orderId,
      callbackUrl: successUrl,
      txnAmount: {
        value: (amountCents/100).toFixed(2),
        currency: 'INR',
      },
      userInfo: { custId: registration._id.toString(), email: registration.email },
    };
    const checksum = this._checksum(payload);
    const resp = await axios.post(`${this.baseUrl}/theia/api/v1/initiateTransaction?mid=${this.credentials.mid}&orderId=${orderId}`, {
      body: payload,
      head: { signature: checksum },
    });
    if (!resp.data.body || !resp.data.body.txnToken) throw new Error('Paytm error');
    const txnToken = resp.data.body.txnToken;
    await this.logPayment({
      registration: registration._id,
      providerPaymentId: orderId,
      amountCents,
      status: 'initiated',
      currency: 'INR',
    });
    const paymentUrl = `${this.baseUrl}/theia/api/v1/showPaymentPage?mid=${this.credentials.mid}&orderId=${orderId}`;
    return { url: paymentUrl, token: txnToken };
  }

  verifyWebhook(req) {
    // Paytm sends checksumhash param
    const { CHECKSUMHASH, ...rest } = req.body;
    const str = Object.values(rest).join('|') + '|' + this.credentials.key;
    const expected = crypto.createHash('sha256').update(str).digest('hex');
    if (expected !== CHECKSUMHASH) throw new Error('Invalid Paytm checksum');
  }

  async handleWebhook(body) {
    if (body.STATUS !== 'TXN_SUCCESS') return;
    await Payment.findOneAndUpdate({ providerPaymentId: body.ORDERID }, {
      status: 'paid',
      capturedAt: new Date(),
      amountCents: Math.round(parseFloat(body.TXNAMOUNT)*100),
      meta: body,
    });
  }
}
module.exports = PaytmProvider; 