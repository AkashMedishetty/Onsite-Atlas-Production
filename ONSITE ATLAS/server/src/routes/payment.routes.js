const express = require('express');
const { protect, restrict } = require('../middleware/auth.middleware');
const paymentController = require('../controllers/payment.controller');
const router = express.Router({ mergeParams: true });

// Payment links
router.post('/links', protect, restrict('admin', 'staff'), paymentController.createPaymentLink);
router.get('/links', protect, restrict('admin', 'staff'), paymentController.listPaymentLinks);
router.post('/links/:id/cancel', protect, restrict('admin', 'staff'), paymentController.cancelPaymentLink);

// Public redeem link (no auth)
router.get('/links/:token/redeem', paymentController.redeemPaymentLink);

// Payments list
router.get('/', protect, restrict('admin', 'staff'), paymentController.listPayments);

// Payment detail
router.get('/:paymentId', protect, restrict('admin','staff'), paymentController.getPaymentDetail);

// Invoice download
router.get('/:paymentId/invoice', protect, restrict('admin','staff'), paymentController.downloadInvoice);

// Offline payment
router.post('/offline', protect, restrict('admin','staff'), paymentController.createOfflinePayment);

// Mark payment as paid
router.post('/:paymentId/mark-paid', protect, restrict('admin','staff'), paymentController.markPaymentPaid);

router.post('/bulk-payment-links', protect, restrict('admin', 'staff'), paymentController.sendBulkPaymentLinks);

// Public invoice download route (no auth required for registrants)
router.get('/public-invoice/:registrationId', paymentController.downloadInvoice);

module.exports = router; 