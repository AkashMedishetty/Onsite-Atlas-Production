const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  getDashboardWidgets,
  getDashboard,
  updateDashboardLayout,
  getWidgetData,
  getEventDashboard,
  getGlobalDashboard
} = require('../controllers/dashboard.controller');

// Get available dashboard widgets
router.get('/events/:eventId/widgets', protect, getDashboardWidgets);

// Get dashboard for a specific event
router.get('/events/:eventId', protect, getDashboard);

// Update dashboard layout
router.put('/events/:eventId', protect, updateDashboardLayout);

// Get data for a specific widget
router.get('/events/:eventId/widgets/:widgetId/data', protect, getWidgetData);

// Event dashboard endpoint 
router.get('/events/:id/dashboard', protect, getEventDashboard);

// Global dashboard endpoint (admin only)
router.get('/global', protect, getGlobalDashboard);

module.exports = router; 