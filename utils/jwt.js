const jwt = require('jsonwebtoken');

/**
 * Generate a short-lived access token (15 min default)
 */
const generateAccessToken = (userId, role) => {
  let payload;
  if (typeof userId === 'object' && userId !== null && !userId._bsontype && (userId.userId || userId.id) && userId.constructor?.name === 'Object') {
    payload = userId;
  } else {
    const idStr = String(userId?._id || userId);
    payload = { userId: idStr, role };
  }
  return jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET || 'hingeout_access_secret_2026',
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '1d' }
  );
};

/**
 * Generate a long-lived refresh token (7 days default)
 */
const generateRefreshToken = (userId) => {
  const idStr = String(userId?._id || userId);
  return jwt.sign(
    { userId: idStr },
    process.env.JWT_REFRESH_SECRET || 'hingeout_refresh_secret_2026',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
};

/**
 * Verify an access token — returns payload or throws
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'hingeout_access_secret_2026');
};

/**
 * Verify a refresh token — returns payload or throws
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

/**
 * Set refresh token as httpOnly cookie
 */
const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,          // JS can't access it — XSS protection
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
};

/**
 * Clear the refresh cookie on logout
 */
const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
};
