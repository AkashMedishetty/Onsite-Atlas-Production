const Payment = require('../models/Payment');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const logger = require('../utils/logger');
const moment = require('moment');

/**
 * Payment Reconciliation Service
 * Handles automated reconciliation between payment gateway records and database
 */
class PaymentReconciliationService {
  constructor() {
    this.providerServices = {
      razorpay: this.reconcileRazorpay.bind(this),
      stripe: this.reconcileStripe.bind(this),
      paytm: this.reconcilePaytm.bind(this),
      cashfree: this.reconcileCashfree.bind(this),
      phonepe: this.reconcilePhonePe.bind(this),
      payu: this.reconcilePayU.bind(this)
    };
  }

  /**
   * Perform daily reconciliation for all events
   * @param {Date} reconciliationDate - Date to reconcile (defaults to yesterday)
   * @returns {Promise<Object>} Reconciliation summary
   */
  async performDailyReconciliation(reconciliationDate = null) {
    try {
      const date = reconciliationDate || moment().subtract(1, 'day').toDate();
      const startDate = moment(date).startOf('day').toDate();
      const endDate = moment(date).endOf('day').toDate();

      logger.info(`Starting daily reconciliation for ${moment(date).format('YYYY-MM-DD')}`);

      // Get all events with payments on this date
      const events = await Event.find({
        'paymentConfig.provider': { $exists: true }
      });

      const reconciliationResults = {
        date: moment(date).format('YYYY-MM-DD'),
        events: [],
        summary: {
          totalEvents: events.length,
          totalPayments: 0,
          matched: 0,
          mismatched: 0,
          missing: 0,
          errors: 0
        }
      };

      for (const event of events) {
        try {
          const eventResult = await this.reconcileEventPayments(event._id, startDate, endDate);
          reconciliationResults.events.push(eventResult);
          
          // Update summary
          reconciliationResults.summary.totalPayments += eventResult.summary.totalPayments;
          reconciliationResults.summary.matched += eventResult.summary.matched;
          reconciliationResults.summary.mismatched += eventResult.summary.mismatched;
          reconciliationResults.summary.missing += eventResult.summary.missing;
          reconciliationResults.summary.errors += eventResult.summary.errors;

        } catch (eventError) {
          logger.error(`Error reconciling event ${event._id}:`, eventError);
          reconciliationResults.summary.errors++;
        }
      }

      // Save reconciliation report
      await this.saveReconciliationReport(reconciliationResults);

      logger.info(`Daily reconciliation completed. Summary:`, reconciliationResults.summary);
      
      return reconciliationResults;

    } catch (error) {
      logger.error('Error in daily reconciliation:', error);
      throw error;
    }
  }

  /**
   * Reconcile payments for a specific event
   * @param {String} eventId - Event ID
   * @param {Date} startDate - Start date for reconciliation
   * @param {Date} endDate - End date for reconciliation
   * @returns {Promise<Object>} Event reconciliation results
   */
  async reconcileEventPayments(eventId, startDate, endDate) {
    try {
      const event = await Event.findById(eventId);
      if (!event || !event.paymentConfig?.provider) {
        throw new Error(`Event ${eventId} not found or payment provider not configured`);
      }

      const provider = event.paymentConfig.provider;
      const reconcileFunction = this.providerServices[provider];
      
      if (!reconcileFunction) {
        throw new Error(`Reconciliation not supported for provider: ${provider}`);
      }

      // Get database payments for this event and date range
      const dbPayments = await Payment.find({
        event: eventId,
        createdAt: { $gte: startDate, $lte: endDate }
      }).populate('registration', 'registrationId');

      // Get gateway payments
      const gatewayPayments = await reconcileFunction(event, startDate, endDate);

      // Compare and find discrepancies
      const comparison = this.comparePayments(dbPayments, gatewayPayments);

      const eventResult = {
        eventId: eventId,
        eventName: event.name,
        provider: provider,
        dateRange: {
          start: startDate,
          end: endDate
        },
        comparison,
        summary: {
          totalPayments: dbPayments.length,
          gatewayPayments: gatewayPayments.length,
          matched: comparison.matched.length,
          mismatched: comparison.mismatched.length,
          missing: comparison.missing.length,
          errors: 0
        }
      };

      // Handle discrepancies
      await this.handleDiscrepancies(eventResult);

      return eventResult;

    } catch (error) {
      logger.error(`Error reconciling event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Compare database payments with gateway payments
   * @param {Array} dbPayments - Database payments
   * @param {Array} gatewayPayments - Gateway payments
   * @returns {Object} Comparison results
   */
  comparePayments(dbPayments, gatewayPayments) {
    const matched = [];
    const mismatched = [];
    const missing = [];
    const extra = [];

    // Create maps for efficient lookup
    const dbPaymentMap = new Map();
    const gatewayPaymentMap = new Map();

    dbPayments.forEach(payment => {
      dbPaymentMap.set(payment.providerPaymentId, payment);
    });

    gatewayPayments.forEach(payment => {
      gatewayPaymentMap.set(payment.id, payment);
    });

    // Check each database payment against gateway
    for (const dbPayment of dbPayments) {
      const gatewayPayment = gatewayPaymentMap.get(dbPayment.providerPaymentId);
      
      if (!gatewayPayment) {
        missing.push({
          type: 'missing_from_gateway',
          dbPayment: dbPayment,
          issue: 'Payment exists in database but not found in gateway'
        });
      } else {
        // Compare payment details
        const discrepancies = this.findPaymentDiscrepancies(dbPayment, gatewayPayment);
        
        if (discrepancies.length === 0) {
          matched.push({
            dbPayment: dbPayment,
            gatewayPayment: gatewayPayment
          });
        } else {
          mismatched.push({
            type: 'data_mismatch',
            dbPayment: dbPayment,
            gatewayPayment: gatewayPayment,
            discrepancies: discrepancies
          });
        }
      }
    }

    // Check for extra gateway payments not in database
    for (const gatewayPayment of gatewayPayments) {
      if (!dbPaymentMap.has(gatewayPayment.id)) {
        extra.push({
          type: 'missing_from_database',
          gatewayPayment: gatewayPayment,
          issue: 'Payment exists in gateway but not found in database'
        });
      }
    }

    return {
      matched,
      mismatched,
      missing,
      extra
    };
  }

  /**
   * Find discrepancies between database and gateway payment
   * @param {Object} dbPayment - Database payment
   * @param {Object} gatewayPayment - Gateway payment
   * @returns {Array} Array of discrepancies
   */
  findPaymentDiscrepancies(dbPayment, gatewayPayment) {
    const discrepancies = [];

    // Check amount
    const dbAmountCents = dbPayment.amountCents;
    const gatewayAmountCents = gatewayPayment.amount;
    
    if (dbAmountCents !== gatewayAmountCents) {
      discrepancies.push({
        field: 'amount',
        dbValue: dbAmountCents,
        gatewayValue: gatewayAmountCents,
        difference: Math.abs(dbAmountCents - gatewayAmountCents)
      });
    }

    // Check status
    const normalizedDbStatus = this.normalizePaymentStatus(dbPayment.status);
    const normalizedGatewayStatus = this.normalizePaymentStatus(gatewayPayment.status);
    
    if (normalizedDbStatus !== normalizedGatewayStatus) {
      discrepancies.push({
        field: 'status',
        dbValue: dbPayment.status,
        gatewayValue: gatewayPayment.status,
        normalizedDbValue: normalizedDbStatus,
        normalizedGatewayValue: normalizedGatewayStatus
      });
    }

    // Check currency
    if (dbPayment.currency !== gatewayPayment.currency) {
      discrepancies.push({
        field: 'currency',
        dbValue: dbPayment.currency,
        gatewayValue: gatewayPayment.currency
      });
    }

    return discrepancies;
  }

  /**
   * Normalize payment status for comparison
   * @param {String} status - Payment status
   * @returns {String} Normalized status
   */
  normalizePaymentStatus(status) {
    const statusMap = {
      'captured': 'paid',
      'successful': 'paid',
      'success': 'paid',
      'completed': 'paid',
      'authorized': 'pending',
      'created': 'pending',
      'initiated': 'pending',
      'failed': 'failed',
      'cancelled': 'failed',
      'refunded': 'refunded'
    };

    return statusMap[status?.toLowerCase()] || status?.toLowerCase() || 'unknown';
  }

  /**
   * Handle payment discrepancies
   * @param {Object} eventResult - Event reconciliation result
   */
  async handleDiscrepancies(eventResult) {
    const { comparison } = eventResult;

    // Handle missing payments (sync from gateway to database)
    for (const extraPayment of comparison.extra) {
      try {
        await this.syncPaymentFromGateway(extraPayment.gatewayPayment, eventResult.eventId);
        logger.info(`Synced missing payment ${extraPayment.gatewayPayment.id} to database`);
      } catch (error) {
        logger.error(`Failed to sync payment ${extraPayment.gatewayPayment.id}:`, error);
        eventResult.summary.errors++;
      }
    }

    // Handle mismatched payments (update database with gateway data)
    for (const mismatch of comparison.mismatched) {
      try {
        await this.updateMismatchedPayment(mismatch);
        logger.info(`Updated mismatched payment ${mismatch.dbPayment._id}`);
      } catch (error) {
        logger.error(`Failed to update mismatched payment ${mismatch.dbPayment._id}:`, error);
        eventResult.summary.errors++;
      }
    }

    // Log missing payments for manual review
    for (const missing of comparison.missing) {
      logger.warn(`Payment missing from gateway: ${missing.dbPayment.providerPaymentId} - ${missing.issue}`);
    }
  }

  /**
   * Sync payment from gateway to database
   * @param {Object} gatewayPayment - Gateway payment data
   * @param {String} eventId - Event ID
   */
  async syncPaymentFromGateway(gatewayPayment, eventId) {
    try {
      // Find associated registration
      const registration = await Registration.findOne({
        event: eventId,
        // Try to match by various fields that might be in payment metadata
        $or: [
          { registrationId: gatewayPayment.metadata?.registrationId },
          { 'personalInfo.email': gatewayPayment.email },
          { _id: gatewayPayment.metadata?.registrationDbId }
        ]
      });

      const paymentData = {
        event: eventId,
        registration: registration?._id,
        providerPaymentId: gatewayPayment.id,
        amountCents: gatewayPayment.amount,
        currency: gatewayPayment.currency || 'INR',
        status: this.normalizePaymentStatus(gatewayPayment.status),
        method: gatewayPayment.method,
        provider: gatewayPayment.provider || 'unknown',
        createdAt: new Date(gatewayPayment.created_at || gatewayPayment.createdAt),
        meta: gatewayPayment,
        syncedFromGateway: true
      };

      if (gatewayPayment.captured_at || gatewayPayment.capturedAt) {
        paymentData.capturedAt = new Date(gatewayPayment.captured_at || gatewayPayment.capturedAt);
      }

      await Payment.create(paymentData);

      // Update registration payment status if found
      if (registration && paymentData.status === 'paid') {
        registration.paymentStatus = 'paid';
        registration.amountCents = gatewayPayment.amount;
        await registration.save();
      }

    } catch (error) {
      logger.error('Error syncing payment from gateway:', error);
      throw error;
    }
  }

  /**
   * Update mismatched payment in database
   * @param {Object} mismatch - Mismatch object
   */
  async updateMismatchedPayment(mismatch) {
    try {
      const { dbPayment, gatewayPayment, discrepancies } = mismatch;

      const updates = {};
      let shouldUpdate = false;

      for (const discrepancy of discrepancies) {
        switch (discrepancy.field) {
          case 'amount':
            updates.amountCents = gatewayPayment.amount;
            shouldUpdate = true;
            break;
          case 'status':
            updates.status = this.normalizePaymentStatus(gatewayPayment.status);
            shouldUpdate = true;
            break;
          case 'currency':
            updates.currency = gatewayPayment.currency;
            shouldUpdate = true;
            break;
        }
      }

      if (shouldUpdate) {
        updates.lastReconciled = new Date();
        updates.reconciliationNote = `Updated during reconciliation: ${discrepancies.map(d => d.field).join(', ')}`;
        
        await Payment.findByIdAndUpdate(dbPayment._id, updates);

        // Update registration if payment status changed to paid
        if (updates.status === 'paid' && dbPayment.status !== 'paid' && dbPayment.registration) {
          await Registration.findByIdAndUpdate(dbPayment.registration, {
            paymentStatus: 'paid',
            amountCents: updates.amountCents || dbPayment.amountCents
          });
        }
      }

    } catch (error) {
      logger.error('Error updating mismatched payment:', error);
      throw error;
    }
  }

  /**
   * Save reconciliation report
   * @param {Object} results - Reconciliation results
   */
  async saveReconciliationReport(results) {
    try {
      const ReconciliationReport = require('../models/ReconciliationReport');
      
      await ReconciliationReport.create({
        date: new Date(results.date),
        summary: results.summary,
        events: results.events,
        generatedAt: new Date()
      });

    } catch (error) {
      logger.error('Error saving reconciliation report:', error);
      // Don't throw error here as it's not critical
    }
  }

  // Provider-specific reconciliation methods
  async reconcileRazorpay(event, startDate, endDate) {
    // This would integrate with Razorpay API to fetch payments
    // For now, return mock data structure
    return [];
  }

  async reconcileStripe(event, startDate, endDate) {
    // This would integrate with Stripe API to fetch payments
    return [];
  }

  async reconcilePaytm(event, startDate, endDate) {
    // This would integrate with Paytm API to fetch payments
    return [];
  }

  async reconcileCashfree(event, startDate, endDate) {
    // This would integrate with Cashfree API to fetch payments
    return [];
  }

  async reconcilePhonePe(event, startDate, endDate) {
    // This would integrate with PhonePe API to fetch payments
    return [];
  }

  async reconcilePayU(event, startDate, endDate) {
    // This would integrate with PayU API to fetch payments
    return [];
  }

  /**
   * Get reconciliation statistics
   * @param {String} eventId - Event ID (optional)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Reconciliation statistics
   */
  async getReconciliationStats(eventId = null, startDate, endDate) {
    try {
      const ReconciliationReport = require('../models/ReconciliationReport');
      
      const query = {
        date: { $gte: startDate, $lte: endDate }
      };

      if (eventId) {
        query['events.eventId'] = eventId;
      }

      const reports = await ReconciliationReport.find(query);

      const stats = {
        totalReports: reports.length,
        totalPayments: 0,
        totalMatched: 0,
        totalMismatched: 0,
        totalMissing: 0,
        totalErrors: 0,
        matchRate: 0
      };

      reports.forEach(report => {
        stats.totalPayments += report.summary.totalPayments;
        stats.totalMatched += report.summary.matched;
        stats.totalMismatched += report.summary.mismatched;
        stats.totalMissing += report.summary.missing;
        stats.totalErrors += report.summary.errors;
      });

      if (stats.totalPayments > 0) {
        stats.matchRate = ((stats.totalMatched / stats.totalPayments) * 100).toFixed(2);
      }

      return stats;

    } catch (error) {
      logger.error('Error getting reconciliation stats:', error);
      throw error;
    }
  }

}

module.exports = new PaymentReconciliationService();
