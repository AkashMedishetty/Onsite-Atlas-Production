const express = require('express');
const publicController = require('../controllers/publicController');
const registrationController = require('../controllers/registration.controller');
const { checkEventNotArchived } = require('../middleware/archive.middleware');

const router = express.Router();

// Public routes that don't require authentication (protected from archived events)
router.get('/events/:slug/landing', checkEventNotArchived, publicController.renderLandingPage);
router.get('/go/:shortCode', publicController.handleShortUrl);

// Component registration public routes removed - now part of event settings only

module.exports = router; 