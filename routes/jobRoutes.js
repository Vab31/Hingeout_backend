const express = require('express');
const router = express.Router();
const {
  getAdminJobs,
  getReviewQueue,
  getJobById,
  createJob,
  updateJob,
  publishJob,
  rejectJob,
  expireJob,
  deleteJob,
  bulkJobAction,
} = require('../controllers/jobController');
const { importTelegramPost, importSourceUrl } = require('../controllers/jobImportController');
const { getAdminAnalytics } = require('../controllers/analyticsController');
const { protect, adminOnly } = require('../middleware/auth');

// All admin routes below require protection
router.use(protect, adminOnly);

router.get('/', getAdminJobs);
router.get('/analytics', getAdminAnalytics);
router.get('/review', getReviewQueue);
router.post('/', createJob);
router.post('/import-telegram', importTelegramPost);
router.post('/import-url', importSourceUrl);
router.post('/bulk-action', bulkJobAction);
router.get('/:id', getJobById);
router.patch('/:id', updateJob);
router.post('/:id/publish', publishJob);
router.post('/:id/reject', rejectJob);
router.post('/:id/expire', expireJob);
router.delete('/:id', deleteJob);

module.exports = router;
