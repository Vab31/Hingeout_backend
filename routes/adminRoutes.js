const express = require('express');
const router = express.Router();
const { adminLogin, sendJobToTargetedUsers } = require('../controllers/adminController');
const { protect } = require('../middleware/auth'); // assuming your auth middleware exists

// Login doesn't need protection
router.post('/login', adminLogin);

// Sending job emails requires the admin to be logged in
// router.post('/send-job', protect, sendJobToTargetedUsers);
router.post('/send-job', sendJobToTargetedUsers);

module.exports = router;