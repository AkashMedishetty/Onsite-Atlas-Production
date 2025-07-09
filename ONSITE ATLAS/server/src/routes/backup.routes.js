const express = require('express');
const {
  listBackups,
  getBackupDetails,
  restoreBackup,
  deleteBackup,
  testBackupSystem
} = require('../controllers/backup.controller');
const { protect, restrict } = require('../middleware/auth.middleware');

const router = express.Router();

// All backup routes require admin access
router.use(protect);
router.use(restrict('admin'));

// Main backup routes
router.route('/')
  .get(listBackups);

router.route('/test')
  .post(testBackupSystem);

router.route('/:backupId')
  .get(getBackupDetails)
  .delete(deleteBackup);

router.route('/:backupId/restore')
  .post(restoreBackup);

module.exports = router; 