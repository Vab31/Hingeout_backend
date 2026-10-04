const express = require('express');
const router = express.Router();
const newsletterController = require('../controllers/newsletterController');

// GET /api/newsletter/preview - Browser preview of the daily email template
router.get('/preview', newsletterController.previewNewsletter);

// GET /api/newsletter/unsubscribe - 1-Click web unsubscribe page
router.get('/unsubscribe', newsletterController.getUnsubscribePage);

// POST /api/newsletter/unsubscribe - RFC 8058 machine-triggered 1-click unsubscribe
router.post('/unsubscribe', newsletterController.handleOneClickUnsubscribe);

// POST /api/newsletter/test-send - Send test email to verify layout and delivery
router.post('/test-send', newsletterController.sendTestEmail);

module.exports = router;
