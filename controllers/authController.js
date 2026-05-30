const { validationResult } = require('express-validator');
const crypto = require('crypto');
const User = require('../models/User');
const connectDB = require('../config/db'); // Added the DB connection utility
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} = require('../utils/jwt');

// ─────────────────────────────────────────────────────────────
// 1. POST /api/auth/register
// ─────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    // Ensure database connection is ready
    await connectDB();

    const { name, email, phone, password, jobTypes } = req.body;

    // Check duplicate email
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Generate verify token — 24h expiry
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // jobTypes can arrive as JSON string from multipart/form-data
    let parsedJobTypes = [];
    if (jobTypes) {
      try {
        parsedJobTypes = typeof jobTypes === 'string' ? JSON.parse(jobTypes) : jobTypes;
      } catch {
        parsedJobTypes = Array.isArray(jobTypes) ? jobTypes : [jobTypes];
      }
    }

    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password,                    // pre-save hook in User.js hashes this
      jobTypes: parsedJobTypes,
      verifyToken,
      verifyTokenExpiry,
      isVerified: false,
    };

    /* ==========================================================
       MODIFIED FOR CLOUDINARY PRODUCTION UPLOADS
       ========================================================== */
    if (req.file) {
      userData.resumePath = req.file.path; 
    }

    const user = await User.create(userData);

    // Send verification email — non-blocking, don't fail registration if email fails
    try {
      await sendVerificationEmail(user, verifyToken);
    } catch (emailErr) {
      console.error('⚠️  Verify email failed:', emailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Account created! Please check your email to verify your account.',
      user: user.toSafeObject(),
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 2. GET /api/auth/verify-email?token=xxx
// ─────────────────────────────────────────────────────────────
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is missing.',
      });
    }

    // Ensure database connection is ready
    await connectDB();

    // Find user with matching token that hasn't expired yet
    const user = await User.findOne({
      verifyToken: token,
      verifyTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification link. Please register again.',
      });
    }

    if (user.isVerified) {
      return res.status(200).json({
        success: true,
        message: 'Email already verified. You can log in.',
      });
    }

    // Activate account and clear token fields
    user.isVerified = true;
    user.verifyToken = null;
    user.verifyTokenExpiry = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 3. POST /api/auth/login
// ─────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    // Ensure database connection is ready
    await connectDB();

    const { email, password } = req.body;

    // Must select +password because it has select:false in schema
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    // Generic error — don't reveal whether email exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in. Check your inbox.',
      });
    }

    // Issue tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Persist refresh token to DB so we can invalidate it on logout
    user.refreshToken = refreshToken;
    await user.save();

    // Refresh token goes in httpOnly cookie — JS can't touch it
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      accessToken,
      user: user.toSafeObject(),
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 4. POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    // Ensure database connection is ready
    await connectDB();

    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return same response — never reveal if email exists
    const genericMsg = 'If an account with that email exists, a reset link has been sent.';

    if (!user) {
      return res.status(200).json({ success: true, message: genericMsg });
    }

    // Generate reset token — 1h expiry
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    try {
      await sendPasswordResetEmail(user, resetToken);
    } catch (emailErr) {
      console.error('⚠️  Reset email failed:', emailErr.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to send reset email. Please try again.',
      });
    }

    return res.status(200).json({ success: true, message: genericMsg });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 5. POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    // Ensure database connection is ready
    await connectDB();

    const { token, password } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset link. Please request a new one.',
      });
    }

    // Update password — pre-save hook hashes it automatically
    user.password = password;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    user.refreshToken = null;   // Kick out all existing sessions
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 6. POST /api/auth/refresh-token
// ─────────────────────────────────────────────────────────────
const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token found. Please log in.',
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token.',
      });
    }

    // Ensure database connection is ready
    await connectDB();

    // Make sure stored token matches — prevents reuse after logout
    const user = await User.findById(decoded.userId).select('+refreshToken');
    if (!user || user.refreshToken !== token) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Session invalid. Please log in again.',
      });
    }

    const newAccessToken = generateAccessToken(user._id, user.role);

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 7. POST /api/auth/logout
// ─────────────────────────────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      // Ensure database connection is ready
      await connectDB();

      // Clear token from DB so it can't be reused
      await User.findOneAndUpdate(
        { refreshToken: token },
        { refreshToken: null }
      );
    }
    clearRefreshCookie(res);
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

const getProfile = async (req, res) => {
  try {
    // Ensure database connection is ready
    await connectDB();

    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = {
  register,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  getProfile
};