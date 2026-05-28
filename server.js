require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const { verifyEmailConnection } = require('./utils/email');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/adminRoutes');

// ── Route imports (we'll add these as we build each feature) ──
// const authRoutes    = require('./routes/auth');
// const userRoutes    = require('./routes/user');
// const adminRoutes   = require('./routes/admin');
// const jobRoutes     = require('./routes/jobs');

const app = express();

// ── Connect to DB ─────────────────────────────────────────
connectDB();

// ── Verify email transporter ──────────────────────────────
verifyEmailConnection();

// ── Global rate limiter ───────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per IP per window
  message: { message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,  // Only 10 login/register attempts per 15 min
  message: { message: 'Too many auth attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Middleware ────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,  // Allow cookies (refresh token)
}));

app.use(express.json({ limit: '10kb' }));         // Body size limit
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(globalLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes); 

// ── Static: serve uploaded resumes (dev only) ─────────────
// In production, files go to Cloudinary — this line is skipped
if (process.env.NODE_ENV === 'development') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// ── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── Routes ────────────────────────────────────────────────
// app.use('/api/auth',  authLimiter, authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api/jobs',  jobRoutes);

// Placeholder so server starts without routes
app.get('/api', (req, res) => {
  res.json({ message: 'Student Jobs API is running 🚀' });
});

// ── 404 + Error handlers (must be last) ──────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health\n`);
});

module.exports = app;
