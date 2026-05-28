const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // ── Core details ──────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be under 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[+]?[\d\s\-().]{7,20}$/, 'Please enter a valid phone number'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never returned in queries by default
    },

    // ── Professional details ──────────────────────────────
  jobTypes: {
  type: [String],
  enum: {
    values: [
      'full-time',
      'part-time',
      'internship',
      'remote',
      'freelance',
      'contract',

      // High-level categories
      'tech',
      'non-tech',
      'design',
      'product',
      'core-engineering',
      'finance',
      'research',
      'freelance-creator',
    ],
    message: '{VALUE} is not a valid job type',
  },
  default: [],
},
    resumePath: {
      type: String,   // Local: relative path | Cloudinary: secure URL
      default: null,
    },

    resumePublicId: {
      type: String,   // Cloudinary public_id for deletion — null on local
      default: null,
    },

    // ── Auth & verification ───────────────────────────────
    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    verifyToken: {
      type: String,
      default: null,
    },

    verifyTokenExpiry: {
      type: Date,
      default: null,
    },

    resetToken: {
      type: String,
      default: null,
    },

    resetTokenExpiry: {
      type: Date,
      default: null,
    },

    refreshToken: {
      type: String,
      select: false,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt + updatedAt automatically
  }
);

// ── Indexes ───────────────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ verifyToken: 1 });
userSchema.index({ resetToken: 1 });

// ── Pre-save hook: hash password before saving ────────────
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  // No next() needed — Mongoose awaits this function automatically
  // Errors thrown here are caught by Mongoose and passed to the caller
});

// ── Instance method: compare password ────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance method: safe user object (no sensitive fields) ──
userSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    jobTypes: this.jobTypes,
    resumePath: this.resumePath,
    role: this.role,
    isVerified: this.isVerified,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('User', userSchema);
