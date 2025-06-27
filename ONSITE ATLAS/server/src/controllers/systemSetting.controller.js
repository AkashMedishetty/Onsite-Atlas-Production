const SystemSetting = require('../models/SystemSetting');
const asyncHandler = require('../middleware/async');
const { sendSuccess } = require('../utils/responseFormatter');
const { createApiError } = require('../middleware/error');

// Get global system settings (singleton)
exports.getSettings = asyncHandler(async (req, res, next) => {
  let settings = await SystemSetting.findOne();
  if (!settings) {
    settings = await SystemSetting.create({});
  }
  return sendSuccess(res, 200, 'Settings retrieved', settings);
});

// Update global system settings
exports.updateSettings = asyncHandler(async (req, res, next) => {
  let settings = await SystemSetting.findOne();
  if (!settings) {
    settings = await SystemSetting.create({});
  }
  Object.assign(settings, req.body);
  await settings.save();
  return sendSuccess(res, 200, 'Settings updated', settings);
}); 