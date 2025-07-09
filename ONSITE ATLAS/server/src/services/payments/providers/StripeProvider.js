const Stripe = require('stripe');
const PaymentProvider = require('../PaymentProvider');
const Payment = require('../../../models/Payment');

class StripeProvider extends PaymentProvider {
  constructor(event) {
    super(event);
    if (!this.credentials.secretKey) {
      throw new Error('Stripe secretKey not configured');
    }
    this.stripe = new Stripe(this.credentials.secretKey, {
      apiVersion: '2023-10-16',
    });
  }

  async createCheckout({ registration, amountCents, successUrl, cancelUrl }) {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: registration.email,
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: `Registration ${registration._id}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        registrationId: registration._id.toString(),
        eventId: this.event._id.toString(),
      },
    });

    await this.logPayment({
      registration: registration._id,
      providerPaymentId: session.id,
      amountCents,
      status: 'initiated',
      currency: 'INR',
    });

    return { url: session.url };
  }

  verifyWebhook(req) {
    const sig = req.headers['stripe-signature'];
    if (!sig) throw new Error('Missing Stripe signature header');
    try {
      req.eventStripeEvent = this.stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        this.credentials.webhookSecret
      );
    } catch (error) {
      throw new Error('Invalid Stripe signature');
    }
  }

  async handleWebhook(body) {
    const event = body.type ? body : null; // if verifyWebhook not used
    const stripeEvent = event || body; // fallback
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        if (session.payment_status !== 'paid') return;
        const amount = session.amount_total;
        await Payment.findOneAndUpdate({ providerPaymentId: session.id }, {
          status: 'paid',
          capturedAt: new Date(),
          amountCents: amount,
          currency: session.currency.toUpperCase(),
          meta: stripeEvent,
        });

        const paymentDoc = await Payment.findOne({ providerPaymentId: session.id });
        if (paymentDoc && paymentDoc.registration) {
          const Registration = require('../../../models/Registration');
          await Registration.findByIdAndUpdate(paymentDoc.registration, { paymentStatus: 'paid', amountCents: paymentDoc.amountCents });
        }
        break;
      }
      default:
        break;
    }
  }
}

module.exports = StripeProvider; 