const express = require('express');
const router = express.Router({ mergeParams:true });
const { protect, restrict } = require('../middleware/auth.middleware');
const controller = require('../controllers/abstractAuthor.controller');

router.get('/events/:eventId/abstract-authors', protect, restrict('admin','staff'), controller.getAuthors);

module.exports = router; 