const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Job slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
    },
    shortDescription: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: 'Remote',
      trim: true,
    },
    country: {
      type: String,
      default: 'India',
      trim: true,
    },
    experienceMin: {
      type: Number,
      default: null,
    },
    experienceMax: {
      type: Number,
      default: null,
    },
    employmentType: {
      type: String,
      enum: ['Full-Time', 'Part-Time', 'Internship', 'Contract', 'Freelance'],
      default: 'Full-Time',
    },
    workMode: {
      type: String,
      enum: ['On-site', 'Hybrid', 'Remote'],
      default: 'Remote',
    },
    salaryMin: {
      type: Number,
      default: null,
    },
    salaryMax: {
      type: Number,
      default: null,
    },
    salaryCurrency: {
      type: String,
      default: 'INR',
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    postedDate: {
      type: Date,
      default: Date.now,
    },
    applicationDeadline: {
      type: Date,
      default: null,
    },

    // Source Information
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobSource',
      required: [true, 'Source ID is required'],
    },
    sourceJobId: {
      type: String,
      default: null,
    },
    sourceType: {
      type: String,
      required: [true, 'Source type is required'],
    },
    originalUrl: {
      type: String,
      required: [true, 'Original URL is required'],
      trim: true,
    },
    canonicalUrl: {
      type: String,
      required: [true, 'Canonical URL is required'],
      trim: true,
    },

    // Processing & Scoring Metrics
    relevanceScore: {
      type: Number,
      default: 0,
    },
    isFresherFriendly: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ['VERIFIED', 'UNVERIFIED', 'BROKEN', 'EXPIRED', 'NEEDS_REVIEW'],
      default: 'UNVERIFIED',
    },

    // Publishing Status
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'EXPIRED', 'REJECTED'],
      default: 'DRAFT',
    },

    // CPC / Creator Monetization (Prepared for future CPC API integration)
    cpcRate: {
      type: Number,
      default: 0,
    },
    isCpcEnabled: {
      type: Boolean,
      default: false,
    },
    cpcCurrency: {
      type: String,
      default: 'INR',
    },

    // Analytics counters & verification dates
    viewsCount: {
      type: Number,
      default: 0,
    },
    applyClicksCount: {
      type: Number,
      default: 0,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastVerifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Performance & Filtering Indexes
jobSchema.index({ slug: 1 });
jobSchema.index({ companyId: 1 });
jobSchema.index({ status: 1, isFresherFriendly: 1, createdAt: -1 });
jobSchema.index({ status: 1, category: 1, workMode: 1 });
jobSchema.index({ canonicalUrl: 1 });
jobSchema.index({ sourceId: 1, sourceJobId: 1 });
jobSchema.index({ title: 'text', description: 'text', location: 'text', skills: 'text' });

module.exports = mongoose.model('Job', jobSchema);
