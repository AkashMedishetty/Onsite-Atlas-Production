const express = require('express');
const landingPageController = require('../controllers/landingPageController');
const { protect, restrict } = require('../middleware/auth.middleware');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Restrict to admin and organizer
router.use(restrict('admin', 'organizer'));

router
  .route('/')
  .get(landingPageController.getLandingPages)
  .post(landingPageController.createLandingPage);

router
  .route('/:id')
  .get(landingPageController.getLandingPageById)
  .patch(landingPageController.updateLandingPage)
  .delete(landingPageController.deleteLandingPage);

router.post('/:id/publish', landingPageController.publishLandingPage);
router.get('/:id/preview', landingPageController.previewLandingPage);
router.post('/import-html', landingPageController.importHtmlPage);
router.post('/:id/restore/:versionId', landingPageController.restoreVersion);

module.exports = router; 