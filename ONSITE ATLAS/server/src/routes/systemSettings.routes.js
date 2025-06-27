const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const controller = require('../controllers/systemSetting.controller');

const router = express.Router();

router.route('/')
  .get(protect, controller.getSettings)
  .put(protect, controller.updateSettings);

module.exports = router; 