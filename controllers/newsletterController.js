const { buildSubscriberEmail, verifyUnsubscribeToken } = require('../services/jobDigestService');
const UnsubscribedEmail = require('../models/UnsubscribedEmail');
const nodemailer = require('nodemailer');

// In-memory set + DB tracking for unsubscribes
global.unsubscribedEmails = global.unsubscribedEmails || new Set();

async function recordUnsubscribe(email, reason = '1_click_web') {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) return;
  
  global.unsubscribedEmails.add(cleanEmail);
  try {
    await UnsubscribedEmail.findOneAndUpdate(
      { email: cleanEmail },
      { email: cleanEmail, reason, unsubscribedAt: new Date() },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error(`[Newsletter] Error recording unsubscribe in DB for ${cleanEmail}:`, err.message);
  }
}

/**
 * GET /api/newsletter/preview
 * Live browser preview of the daily digest email
 */
exports.previewNewsletter = async (req, res) => {
  try {
    const { name = 'Vaibhav Singh', email = 'vaibhav@hingeout.com' } = req.query;
    const emailData = await buildSubscriberEmail({ email, name });
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(emailData.html);
  } catch (err) {
    console.error('Preview Error:', err);
    res.status(500).send(`<h3>Error generating email preview:</h3><p>${err.message}</p>`);
  }
};

/**
 * GET /api/newsletter/unsubscribe
 * Render 1-click unsubscribe web confirmation page
 */
exports.getUnsubscribePage = async (req, res) => {
  try {
    const { email, token } = req.query;
    const cleanEmail = (email || '').toLowerCase().trim();

    // Verify token validity
    const isValidToken = verifyUnsubscribeToken(cleanEmail, token);
    
    if (cleanEmail) {
      await recordUnsubscribe(cleanEmail, 'user_clicked_web_link');
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hingeout.com';

    // Return clean, branded confirmation page
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed - HingeOut AI</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 40px; max-width: 460px; width: 90%; text-align: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
    .icon { width: 56px; height: 56px; background: #eff6ff; color: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 20px auto; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 12px 0; color: #0f172a; }
    p { font-size: 14px; color: #64748b; line-height: 1.6; margin: 0 0 24px 0; }
    .email-tag { font-family: monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-weight: 700; color: #334155; }
    .btn { display: inline-block; background: #0f172a; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 12px; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✉️</div>
    <h1>You're Unsubscribed</h1>
    <p>
      We have removed <span class="email-tag">${cleanEmail || 'your email'}</span> from our daily job alert digest. You won't receive these alerts anymore.
    </p>
    <a href="${siteUrl}/jobs" class="btn">Explore Jobs on HingeOut Web</a>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('Unsubscribe Page Error:', err);
    res.status(500).send('An error occurred processing your request.');
  }
};

/**
 * POST /api/newsletter/unsubscribe
 * Machine-triggered RFC 8058 1-click unsubscribe handler (Gmail / Yahoo Mail Client)
 */
exports.handleOneClickUnsubscribe = async (req, res) => {
  try {
    const { email, token } = req.query;
    const cleanEmail = (email || '').toLowerCase().trim();

    if (cleanEmail) {
      await recordUnsubscribe(cleanEmail, 'rfc8058_one_click_post');
      console.log(`[Newsletter] 1-Click Unsubscribed recorded for: ${cleanEmail}`);
    }

    res.status(200).json({
      success: true,
      message: `Unsubscribed ${cleanEmail || 'user'} successfully.`,
    });
  } catch (err) {
    console.error('1-Click Unsubscribe Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/newsletter/test-send
 * Send a live test email to any inbox
 */
exports.sendTestEmail = async (req, res) => {
  try {
    const { toEmail, name = 'Valued Candidate' } = req.body;
    if (!toEmail) {
      return res.status(400).json({ success: false, message: 'toEmail is required in request body.' });
    }

    const emailData = await buildSubscriberEmail({ email: toEmail, name });

    // Use SMTP configured in .env or fallback to GMAIL_USER or Ethereal test transporter
    let transporter;
    const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || process.env.SMTP_PASSWORD;

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
        },
      });
    } else if (gmailUser && gmailPass) {
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });
    } else {
      // Ethereal test account for instant local testing
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const fromAddress = process.env.SMTP_FROM || (gmailUser ? `HingeOut AI Jobs <${gmailUser}>` : 'HingeOut Jobs <jobs@hingeout.com>');

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: emailData.subject,
      html: emailData.html,
      headers: emailData.headers,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    res.json({
      success: true,
      message: `Test email sent to ${toEmail}`,
      messageId: info.messageId,
      previewUrl: previewUrl || null,
    });
  } catch (err) {
    console.error('Send Test Email Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
