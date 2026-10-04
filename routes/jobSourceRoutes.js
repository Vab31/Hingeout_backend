const express = require('express');
const router = express.Router();
const {
  getJobSources,
  createJobSource,
  updateJobSource,
  deleteJobSource,
  triggerSourceCrawl,
  getCrawlRuns,
} = require('../controllers/jobSourceController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

router.get('/', getJobSources);
router.post('/', createJobSource);
router.get('/runs', getCrawlRuns);
router.patch('/:id', updateJobSource);
router.delete('/:id', deleteJobSource);
router.post('/:id/crawl', triggerSourceCrawl);

module.exports = router;
