const express = require('express');
const router = express.Router();
const {
  getPublicJobs,
  getPublicJobBySlug,
  trackApplyAndRedirect,
  getCategories,
} = require('../controllers/publicJobController');

// Public endpoints (no authentication required)
router.get('/', getPublicJobs);
router.get('/meta/categories', getCategories);
router.get('/:id/apply', trackApplyAndRedirect);
router.get('/:slug', getPublicJobBySlug);

module.exports = router;
