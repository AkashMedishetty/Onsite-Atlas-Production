const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, restrict } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/paymentConfig.controller');

router.route('/')
  .get(protect, restrict('admin','staff'), ctrl.getPaymentConfig)
  .put(protect, restrict('admin','staff'), ctrl.updatePaymentConfig);

router.route('/settings').get(ctrl.getPaymentStatus);

module.exports = router; 