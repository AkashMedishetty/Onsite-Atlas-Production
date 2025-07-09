const PaymentProvider = require('../PaymentProvider');
const logger = require('../../../utils/logger');

/**
 * Stub Payment Provider for Testing and Demo
 * Provides mock payment functionality that simulates real payment flow
 */
class StubProvider extends PaymentProvider {
  constructor(event) {
    super(event);
    this.supportedFeatures = {
      partialPayments: true,
      subscriptions: false,
      refunds: true,
      webhooks: true,
      savedCards: false
    };
  }

  /**
   * Create a mock checkout session
   */
  async createCheckout({ registration, lineItems, successUrl, cancelUrl, paymentPlan = null }) {
    try {
      // Generate mock payment ID
      const paymentId = `stub_payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate total amount
      const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
      
      // Log payment attempt
      await this.logPayment({
        registration: registration._id,
        providerPaymentId: paymentId,
        amountCents: totalAmount,
        currency: 'INR',
        status: 'pending',
        method: 'mock',
        metadata: {
          lineItems,
          successUrl,
          cancelUrl,
          paymentPlan: paymentPlan?._id,
          provider: 'stub'
        }
      });

      // Create mock checkout URL with embedded success/failure simulation
      const mockCheckoutUrl = `${process.env.CLIENT_URL}/mock-payment?` +
        `payment_id=${paymentId}&` +
        `amount=${totalAmount}&` +
        `registration_id=${registration._id}&` +
        `success_url=${encodeURIComponent(successUrl)}&` +
        `cancel_url=${encodeURIComponent(cancelUrl)}`;

      logger.info(`Created stub payment checkout for ${registration.registrationId}: ${paymentId}`);

      return {
        url: mockCheckoutUrl,
        paymentId: paymentId
      };

    } catch (error) {
      logger.error('Error creating stub checkout:', error);
      throw new Error(`Stub provider checkout failed: ${error.message}`);
    }
  }

  /**
   * Create partial payment for installments
   */
  async createPartialPayment({ registration, amount, installmentId, successUrl, cancelUrl }) {
    try {
      const paymentId = `stub_installment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.logPayment({
        registration: registration._id,
        providerPaymentId: paymentId,
        amountCents: amount,
        currency: 'INR',
        status: 'pending',
        method: 'mock_installment',
        metadata: {
          installmentId,
          successUrl,
          cancelUrl,
          provider: 'stub'
        }
      });

      const mockCheckoutUrl = `${process.env.CLIENT_URL}/mock-payment?` +
        `payment_id=${paymentId}&` +
        `amount=${amount}&` +
        `registration_id=${registration._id}&` +
        `installment_id=${installmentId}&` +
        `success_url=${encodeURIComponent(successUrl)}&` +
        `cancel_url=${encodeURIComponent(cancelUrl)}`;

      return {
        url: mockCheckoutUrl,
        paymentId: paymentId
      };

    } catch (error) {
      logger.error('Error creating stub partial payment:', error);
      throw error;
    }
  }

  /**
   * Process direct payment
   */
  async processPayment({ registration, amount, paymentMethod, metadata = {} }) {
    try {
      const paymentId = `stub_direct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate success/failure based on amount (for testing)
      const shouldSucceed = amount < 999999; // Amounts >= 999999 will fail for testing
      
      const status = shouldSucceed ? 'captured' : 'failed';
      
      await this.logPayment({
        registration: registration._id,
        providerPaymentId: paymentId,
        amountCents: amount,
        currency: 'INR',
        status: status,
        method: paymentMethod.type || 'mock_card',
        metadata: {
          ...metadata,
          paymentMethod,
          provider: 'stub',
          simulatedPayment: true
        }
      });

      if (!shouldSucceed) {
        throw new Error('Simulated payment failure for testing');
      }

      logger.info(`Processed stub direct payment: ${paymentId}`);
      
      return {
        paymentId: paymentId,
        status: status,
        transactionId: paymentId
      };

    } catch (error) {
      logger.error('Error processing stub payment:', error);
      throw error;
    }
  }

  /**
   * Initiate mock refund
   */
  async refundPayment({ paymentId, amount, reason }) {
    try {
      const refundId = `stub_refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Find original payment
      const Payment = require('../../../models/Payment');
      const originalPayment = await Payment.findOne({ providerPaymentId: paymentId });
      
      if (!originalPayment) {
        throw new Error('Original payment not found');
      }

      // Simulate refund processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create refund record
      await this.logPayment({
        registration: originalPayment.registration,
        providerPaymentId: refundId,
        amountCents: -amount, // Negative amount for refund
        currency: originalPayment.currency,
        status: 'refunded',
        method: 'refund',
        metadata: {
          originalPaymentId: paymentId,
          reason,
          provider: 'stub',
          refundType: 'mock'
        }
      });

      // Update original payment status
      await this.updatePaymentStatus(paymentId, 'refunded', {
        refundId: refundId,
        refundAmount: amount,
        refundReason: reason
      });

      logger.info(`Processed stub refund: ${refundId} for payment: ${paymentId}`);
      
      return {
        refundId: refundId,
        status: 'refunded',
        amount: amount
      };

    } catch (error) {
      logger.error('Error processing stub refund:', error);
      throw error;
    }
  }

  /**
   * Get payment status from mock provider
   */
  async getPaymentStatus(providerPaymentId) {
    try {
      const Payment = require('../../../models/Payment');
      const payment = await Payment.findOne({ providerPaymentId });
      
      if (!payment) {
        return { status: 'not_found' };
      }

      // Simulate some status changes for testing
      let status = payment.status;
      if (status === 'pending' && Math.random() > 0.5) {
        status = 'captured'; // 50% chance of auto-success for pending payments
      }

      return {
        status: status,
        amount: payment.amountCents,
        currency: payment.currency,
        method: payment.method,
        createdAt: payment.createdAt,
        metadata: payment.metadata
      };

    } catch (error) {
      logger.error('Error getting stub payment status:', error);
      throw error;
    }
  }

  /**
   * Verify webhook (mock implementation)
   */
  verifyWebhook(req) {
    try {
      // In real implementation, this would verify signatures
      // For stub, we just check for required headers
      const signature = req.headers['x-stub-signature'];
      const timestamp = req.headers['x-stub-timestamp'];
      
      if (!signature || !timestamp) {
        throw new Error('Missing required webhook headers');
      }

      // Mock signature verification
      const expectedSignature = 'stub_sig_' + Buffer.from(JSON.stringify(req.body)).toString('base64').substr(0, 10);
      
      if (signature !== expectedSignature) {
        logger.warn('Stub webhook signature mismatch');
        // Don't throw error for stub - just log warning
      }

      return true;

    } catch (error) {
      logger.error('Stub webhook verification failed:', error);
      throw error;
    }
  }

  /**
   * Handle webhook payload
   */
  async handleWebhook(body) {
    try {
      const { event_type, payment_id, status, amount, metadata } = body;

      logger.info(`Processing stub webhook: ${event_type} for payment: ${payment_id}`);

      switch (event_type) {
        case 'payment.captured':
          await this.updatePaymentStatus(payment_id, 'captured', metadata);
          break;

        case 'payment.failed':
          await this.updatePaymentStatus(payment_id, 'failed', metadata);
          break;

        case 'payment.refunded':
          await this.updatePaymentStatus(payment_id, 'refunded', metadata);
          break;

        case 'installment.due':
          // Handle installment due notification
          if (metadata.payment_plan_id) {
            await this.processNextInstallment(metadata.payment_plan_id);
          }
          break;

        default:
          logger.warn(`Unknown stub webhook event type: ${event_type}`);
      }

      return { processed: true, event_type, payment_id };

    } catch (error) {
      logger.error('Error handling stub webhook:', error);
      throw error;
    }
  }

  /**
   * Charge installment using mock payment method
   */
  async chargeInstallment({ paymentPlan, installment, paymentMethod }) {
    try {
      const paymentId = `stub_auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Simulate automatic charging
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const result = await this.processPayment({
        registration: paymentPlan.registration,
        amount: installment.amount,
        paymentMethod: paymentMethod,
        metadata: {
          installmentId: installment._id,
          paymentPlanId: paymentPlan._id,
          autoCharge: true
        }
      });

      // Update installment status
      await this.updateInstallmentStatus(installment._id, 'paid');

      logger.info(`Auto-charged stub installment: ${installment._id}`);
      
      return result;

    } catch (error) {
      logger.error('Error charging stub installment:', error);
      await this.updateInstallmentStatus(installment._id, 'failed');
      throw error;
    }
  }

  /**
   * Simulate payment success (for testing)
   */
  async simulatePaymentSuccess(paymentId) {
    try {
      await this.updatePaymentStatus(paymentId, 'captured', {
        simulated: true,
        simulatedAt: new Date()
      });

      // Trigger webhook simulation
      await this.handleWebhook({
        event_type: 'payment.captured',
        payment_id: paymentId,
        status: 'captured',
        metadata: { simulated: true }
      });

      return { success: true, paymentId };

    } catch (error) {
      logger.error('Error simulating payment success:', error);
      throw error;
    }
  }

  /**
   * Simulate payment failure (for testing)
   */
  async simulatePaymentFailure(paymentId, reason = 'Simulated failure') {
    try {
      await this.updatePaymentStatus(paymentId, 'failed', {
        simulated: true,
        simulatedAt: new Date(),
        failureReason: reason
      });

      // Trigger webhook simulation
      await this.handleWebhook({
        event_type: 'payment.failed',
        payment_id: paymentId,
        status: 'failed',
        metadata: { simulated: true, reason }
      });

      return { success: true, paymentId, reason };

    } catch (error) {
      logger.error('Error simulating payment failure:', error);
      throw error;
    }
  }

}

module.exports = StubProvider; 