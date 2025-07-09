const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect, restrict } = require('../middleware/auth.middleware');
const emailController = require('../controllers/email.controller');
const { buildFileUrl } = require('../config/paths');

// ---- Core email routes (no duplicates) ----
router.post('/recipients', protect, emailController.getFilteredRecipients);
router.get('/history', protect, emailController.getEmailHistory);
router.get('/history-debug', protect, emailController.getEmailHistoryDebug);
router.get('/history-enhanced', protect, emailController.getEnhancedEmailHistory);
router.get('/:emailId/failures', protect, emailController.getEmailFailureReport);

router.post('/test-smtp', protect, emailController.testSmtpConfiguration);

router.post('/certificate-template', protect, emailController.uploadCertificateTemplate);
router.post('/brochure', protect, emailController.uploadBrochure);

router.get('/certificates/validate/:certificateId', emailController.validateCertificate);

router.put('/smtp-settings', protect, emailController.updateSmtpSettings);

// Template & sending endpoints (single source of truth)
router.get('/templates', protect, restrict('admin','staff'), emailController.getTemplates);
router.put('/templates/:templateKey', protect, restrict('admin','staff'), emailController.updateTemplate);
router.post('/preview', protect, restrict('admin','staff'), emailController.previewRecipients);
router.post('/send', protect, restrict('admin','staff'), emailController.sendCustomEmail);
router.post('/bulk-send', protect, restrict('admin','staff'), emailController.sendBulkEmail);

module.exports = router; 