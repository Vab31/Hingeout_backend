const nodemailer = require('nodemailer');

// ── Create transporter (reused across all emails) ─────────
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,        // TLS (not SSL)
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,  // App Password, not Gmail password
  },
});

// ── Verify connection on startup (optional but helpful) ───
const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email transporter ready');
  } catch (err) {
    console.warn(`⚠️  Email transporter not ready: ${err.message}`);
  }
};

// ── Shared send helper ────────────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  const mailOptions = {
    from: `"Student Jobs Platform" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  };
  return transporter.sendMail(mailOptions);
};

// ── Email templates ───────────────────────────────────────

/**
 * Verification email sent on registration
 */
const sendVerificationEmail = async (user, token) => {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Verify your email — Student Jobs',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Welcome, ${user.name}! 👋</h2>
        <p>Thanks for signing up. Please verify your email address to activate your account.</p>
        <a href="${verifyUrl}"
           style="display: inline-block; padding: 12px 28px; background: #4f46e5;
                  color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Verify my email
        </a>
        <p style="color: #666; font-size: 14px;">
          This link expires in <strong>24 hours</strong>.<br/>
          If you didn't create an account, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;"/>
        <p style="color: #999; font-size: 12px;">
          Or copy this URL: ${verifyUrl}
        </p>
      </div>
    `,
  });
};

/**
 * Password reset email
 */
const sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Reset your password — Student Jobs',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Reset your password</h2>
        <p>Hi ${user.name}, we received a request to reset your password.</p>
        <a href="${resetUrl}"
           style="display: inline-block; padding: 12px 28px; background: #4f46e5;
                  color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Reset password
        </a>
        <p style="color: #666; font-size: 14px;">
          This link expires in <strong>1 hour</strong>.<br/>
          If you didn't request a reset, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;"/>
        <p style="color: #999; font-size: 12px;">
          Or copy this URL: ${resetUrl}
        </p>
      </div>
    `,
  });
};

/**
 * Bulk email from admin to a list of students
 */
const sendBulkEmail = async ({ recipients, subject, message, adminName }) => {
  // Send to all recipients — in production consider batching
  const promises = recipients.map((email) =>
    sendEmail({
      to: email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">${subject}</h2>
          <div style="white-space: pre-line; line-height: 1.6; color: #333;">
            ${message}
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;"/>
          <p style="color: #999; font-size: 12px;">
            Sent by ${adminName} via Student Jobs Platform
          </p>
        </div>
      `,
    })
  );

  return Promise.allSettled(promises); // allSettled — don't fail if one bounces
};

module.exports = {
  verifyEmailConnection,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBulkEmail,
};
