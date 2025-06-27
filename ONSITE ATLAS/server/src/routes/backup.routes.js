const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backup.controller');
const { protect, restrict } = require('../middleware/auth.middleware');

// Require admin role (simplified): we assume auth middleware verifies token and adds user
router.get('/', protect, restrict('admin'), backupController.createBackup);
router.post('/', protect, restrict('admin'), backupController.restoreBackup);

module.exports = router; 