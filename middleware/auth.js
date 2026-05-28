const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');




const protect = async (req, res, next) => {
  try {
    console.log("Incoming Auth Header:", req.headers.authorization);
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // --- NEW LOGIC FOR HARDCODED ADMIN ---
    if (decoded.role === 'admin') {
      req.user = { id: 'admin_root', role: 'admin', isVerified: true };
      return next();
    }
    // -------------------------------------

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ message: 'User no longer exists.' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

/**
 * Restrict to admin role only
 * Usage: router.delete('/user/:id', protect, adminOnly, controller)
 */
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }
  next();
};

/**
 * Require email to be verified before accessing a route
 */
const requireVerified = (req, res, next) => {
  if (!req.user?.isVerified) {
    return res.status(403).json({
      message: 'Please verify your email address before continuing.',
    });
  }
  next();
};

module.exports = { protect, adminOnly, requireVerified };
