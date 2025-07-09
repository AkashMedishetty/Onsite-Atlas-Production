const express = require('express');
const router = express.Router({ mergeParams: true });
const { createRegistrationPublic } = require('../controllers/registration.controller');

router.post('/', createRegistrationPublic);

module.exports = router; 