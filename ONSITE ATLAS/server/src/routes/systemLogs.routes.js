const express = require('express');
const router = express.Router();
const { protect, restrict } = require('../middleware/auth.middleware');
const logsController = require('../controllers/systemLogs.controller');

// GET /api/system-logs
router.get('/', protect, restrict('admin'), logsController.getLogs);

// GET /api/system-logs/download
router.get('/download', protect, restrict('admin'), logsController.downloadLogs);

module.exports = router; 