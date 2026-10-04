const express = require('express');
const router = express.Router();
const {
  getArthaJobs,
  getArthaFilters,
  getArthaJobById,
  trackArthaApplyAndRedirect,
  syncArthaJobsToDatabase,
} = require('../controllers/arthaJobController');

// Public proxy endpoints
router.get('/jobs', getArthaJobs);
router.get('/filters', getArthaFilters);
router.get('/jobs/:id/apply', trackArthaApplyAndRedirect);
router.get('/jobs/:id', getArthaJobById);

// DB sync endpoint
router.post('/sync', syncArthaJobsToDatabase);

module.exports = router;
