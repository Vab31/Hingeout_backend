// const express = require('express');
// const router = express.Router();
// const { body } = require('express-validator');
// const upload = require('../middleware/upload');
// const {
//   register, verifyEmail, login,
//   forgotPassword, resetPassword,
//   refreshToken, logout,
// } = require('../controllers/authController');
// const { getProfile } = require('../controllers/authController');
// // const protect = require('../middleware/auth');
// // Ensure the path uses '../middleware/auth' and includes curly braces {}
// const { protect, adminOnly, requireVerified } = require('../middleware/auth');


// // Validation rules
// const registerRules = [
//   body('name').trim().notEmpty().withMessage('Name is required'),
//   body('email').isEmail().withMessage('Valid email required'),
//   body('phone').notEmpty().withMessage('Phone is required'),
//   body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
// ];
// const loginRules = [
//   body('email').isEmail().withMessage('Valid email required'),
//   body('password').notEmpty().withMessage('Password is required'),
// ];
// const emailRule = [body('email').isEmail().withMessage('Valid email required')];
// const resetRules = [
//   body('token').notEmpty().withMessage('Token is required'),
//   body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
// ];

// router.post('/register', upload.single('resume'), registerRules, register);
// router.get('/verify-email', verifyEmail);
// router.post('/login', loginRules, login);
// router.post('/forgot-password', emailRule, forgotPassword);
// router.post('/reset-password', resetRules, resetPassword);
// router.post('/refresh-token', refreshToken);
// router.post('/logout', logout);
// // router.get('/profile', getProfile);
// router.get('/profile', protect, getProfile);


// module.exports = router;


const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
// SWAPPED: Changed from local file middleware to your new Cloudinary middleware
const upload = require('../config/cloudinary'); 
const {
  register, verifyEmail, login,
  forgotPassword, resetPassword,
  refreshToken, logout,
  getProfile // Combined into a single destructuring block for cleanliness
} = require('../controllers/authController');

const { protect, adminOnly, requireVerified } = require('../middleware/auth');

// Validation rules
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const loginRules = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const emailRule = [body('email').isEmail().withMessage('Valid email required')];

const resetRules = [
  body('token').notEmpty().withMessage('Token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

/* ==========================================================
   Routes Setup
   ========================================================== */

// This route now transparently streams files to Cloudinary seamlessly!
router.post('/register', upload.single('resume'), registerRules, register);

router.get('/verify-email', verifyEmail);
router.post('/login', loginRules, login);
router.post('/forgot-password', emailRule, forgotPassword);
router.post('/reset-password', resetRules, resetPassword);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.get('/profile', protect, getProfile);

module.exports = router;