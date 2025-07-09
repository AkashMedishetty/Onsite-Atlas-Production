const Payment = require('../../models/Payment');
const PaymentPlan = require('../../models/PaymentPlan');
const logger = require('../../utils/logger');

/**
 * Abstract PaymentProvider with unified API and partial payment support
 * Concrete providers must implement createCheckout(), verifyWebhook(), handleWebhook()
 */
class PaymentProvider {
  constructor(event) {
    if (!event) throw new Error('Event required');
    this.event = event;
    this.credentials = event.paymentConfig?.credentials || {};
    this.mode = event.paymentConfig?.mode || 'test';
    this.supportedFeatures = {
      partialPayments: false,
      subscriptions: false,
      refunds: false,
      webhooks: true,
      savedCards: false
    };
  }

  /**
   * Create a hosted checkout or payment session.
   * Must return { url, paymentId } which front-end will redirect to.
   */
  async createCheckout({ registration, lineItems, successUrl, cancelUrl, paymentPlan = null }) {
    throw new Error('createCheckout not implemented');
  }

  /**
   * Create partial payment checkout for installments
   */
  async createPartialPayment({ registration, amount, installmentId, successUrl, cancelUrl }) {
    if (!this.supportedFeatures.partialPayments) {
      throw new Error('Partial payments not supported by this provider');
    }
    throw new Error('createPartialPayment not implemented');
  }

  /**
   * Process direct payment (for cards, etc.)
   */
  async processPayment({ registration, amount, paymentMethod, metadata = {} }) {
    throw new Error('processPayment not implemented');
  }

  /**
   * Initiate refund
   */
  async refundPayment({ paymentId, amount, reason }) {
    if (!this.supportedFeatures.refunds) {
      throw new Error('Refunds not supported by this provider');
    }
    throw new Error('refundPayment not implemented');
  }

  /**
   * Get payment status from provider
   */
  async getPaymentStatus(providerPaymentId) {
    throw new Error('getPaymentStatus not implemented');
  }

  /**
   * Verify webhook authenticity. Throw if invalid.
   */
  verifyWebhook(req) {
    throw new Error('verifyWebhook not implemented');
  }

  /**
   * Handle webhook payload and update DB.
   */
  async handleWebhook(body) {
    throw new Error('handleWebhook not implemented');
  }

  /**
   * Create payment plan for installments
   */
  async createPaymentPlan({ registration, totalAmount, installments, autoCharge = false }) {
    try {
      const installmentAmount = totalAmount / installments;
      const plan = new PaymentPlan({
        registration: registration._id,
        event: this.event._id,
        totalAmount,
        provider: this.event.paymentConfig.provider,
        autoCharge,
        installments: Array.from({ length: installments }, (_, i) => ({
          amount: i === installments - 1 
            ? totalAmount - (installmentAmount * (installments - 1)) // Last installment handles rounding
            : installmentAmount,
          dueDate: new Date(Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000), // Monthly
          status: i === 0 ? 'due' : 'pending'
        }))
      });

      await plan.save();
      return plan;
    } catch (error) {
      logger.error('Failed to create payment plan:', error);
      throw error;
    }
  }

  /**
   * Process next installment
   */
  async processNextInstallment(paymentPlanId) {
    try {
      const plan = await PaymentPlan.findById(paymentPlanId).populate('registration');
      if (!plan) {
        throw new Error('Payment plan not found');
      }

      const nextInstallment = plan.installments.find(i => i.status === 'due');
      if (!nextInstallment) {
        throw new Error('No due installments found');
      }

      if (plan.autoCharge && plan.savedPaymentMethod) {
        // Charge saved payment method
        const result = await this.chargeInstallment({
          paymentPlan: plan,
          installment: nextInstallment,
          paymentMethod: plan.savedPaymentMethod
        });
        return result;
      } else {
        // Create checkout for manual payment
        const result = await this.createPartialPayment({
          registration: plan.registration,
          amount: nextInstallment.amount,
          installmentId: nextInstallment._id,
          successUrl: `${process.env.CLIENT_URL}/payment/success`,
          cancelUrl: `${process.env.CLIENT_URL}/payment/cancel`
        });
        return result;
      }
    } catch (error) {
      logger.error('Failed to process next installment:', error);
      throw error;
    }
  }

  /**
   * Charge installment using saved payment method
   */
  async chargeInstallment({ paymentPlan, installment, paymentMethod }) {
    throw new Error('chargeInstallment not implemented');
  }

  /**
   * Helper to log a payment attempt with enhanced features
   */
  async logPayment(data) {
    try {
      const paymentData = {
        ...data,
        event: this.event._id,
        provider: this.event.paymentConfig.provider,
        createdAt: new Date(),
        metadata: {
          ...data.metadata,
          providerFeatures: this.supportedFeatures
        }
      };

      if (!data.providerPaymentId) {
        // Create new payment record
        const payment = new Payment(paymentData);
        await payment.save();
        return payment;
      }

      // Update existing payment
      const updated = await Payment.findOneAndUpdate(
        { 
          provider: this.event.paymentConfig.provider, 
          providerPaymentId: data.providerPaymentId 
        },
        { 
          $setOnInsert: { event: this.event._id },
          $set: paymentData
        },
        { new: true, upsert: true }
      );

      return updated;
    } catch (error) {
      logger.error('Failed to log payment:', error);
      throw error;
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(providerPaymentId, status, metadata = {}) {
    try {
      const payment = await Payment.findOneAndUpdate(
        {
          provider: this.event.paymentConfig.provider,
          providerPaymentId
        },
        {
          $set: {
            status,
            updatedAt: new Date(),
            metadata: { ...metadata }
          }
        },
        { new: true }
      );

      if (!payment) {
        logger.warn(`Payment not found for provider ID: ${providerPaymentId}`);
        return null;
      }

      // Update payment plan if this is an installment
      if (payment.installmentId) {
        await this.updateInstallmentStatus(payment.installmentId, status);
      }

      return payment;
    } catch (error) {
      logger.error('Failed to update payment status:', error);
      throw error;
    }
  }

  /**
   * Update installment status
   */
  async updateInstallmentStatus(installmentId, status) {
    try {
      await PaymentPlan.updateOne(
        { 'installments._id': installmentId },
        {
          $set: {
            'installments.$.status': status,
            'installments.$.updatedAt': new Date()
          }
        }
      );

      // Check if all installments are paid
      const plan = await PaymentPlan.findOne({ 'installments._id': installmentId });
      if (plan) {
        const allPaid = plan.installments.every(i => i.status === 'paid');
        if (allPaid) {
          plan.status = 'completed';
          plan.completedAt = new Date();
          await plan.save();
        }
      }
    } catch (error) {
      logger.error('Failed to update installment status:', error);
      throw error;
    }
  }

  /**
   * Send payment notifications
   */
  async sendPaymentNotification(paymentId, type) {
    try {
      const NotificationService = require('../NotificationService');
      const payment = await Payment.findById(paymentId).populate('registration');
      
      if (!payment || !payment.registration) {
        return;
      }

      await NotificationService.sendNotification(
        'email',
        type,
        this.event._id,
        [payment.registration.personalInfo.email],
        {
          participantName: `${payment.registration.personalInfo.firstName} ${payment.registration.personalInfo.lastName}`,
          eventName: this.event.name,
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.providerPaymentId,
          paymentDate: payment.createdAt.toLocaleDateString()
        }
      );
    } catch (error) {
      logger.error('Failed to send payment notification:', error);
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      name: this.constructor.name,
      supportedFeatures: this.supportedFeatures,
      credentials: Object.keys(this.credentials),
      mode: this.mode
    };
  }
}

module.exports = PaymentProvider; 