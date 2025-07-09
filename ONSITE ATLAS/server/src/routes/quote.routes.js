const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { quoteRegistration } = require('../controllers/quote.controller');
const router = express.Router({ mergeParams: true });

router.post('/', protect, quoteRegistration);

module.exports = router; 