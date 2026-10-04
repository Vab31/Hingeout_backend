const express = require('express');
const router = express.Router();
const {
  getCreatorStats,
  getCreatorJobs,
  getCreatorPerformance,
  getSharedLinks,
  becomeCreator,
} = require('../controllers/creatorController');
const { protect } = require('../middleware/auth');

// All creator routes require authentication
router.use(protect);

router.get('/stats', getCreatorStats);
router.get('/jobs', getCreatorJobs);
router.get('/performance', getCreatorPerformance);
router.get('/shared-links', getSharedLinks);
router.post('/become-creator', becomeCreator);

module.exports = router;
