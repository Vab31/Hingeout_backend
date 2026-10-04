const mongoose = require('mongoose');

const jobClickSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    jobTitle: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    referrer: {
      type: String,
      default: '',
    },
    sessionId: {
      type: String,
      default: '',
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
    },
    userAgent: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      default: '',
    },
    // User Referral Tracking
    referrerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    referralCode: {
      type: String,
      default: '',
      index: true,
    },
    refCode: {
      type: String,
      default: '',
      index: true,
    },
    cpcEarned: {
      type: Number,
      default: 0,
    },
    isUniqueClick: {
      type: Boolean,
      default: true,
    },
    isUnique: {
      type: Boolean,
      default: true,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    visitorIp: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

jobClickSchema.index({ jobId: 1, timestamp: -1 });
jobClickSchema.index({ referrerUserId: 1, timestamp: -1 });
jobClickSchema.index({ creatorId: 1, timestamp: -1 });
jobClickSchema.index({ jobId: 1, ipAddress: 1, timestamp: -1 });

module.exports = mongoose.model('JobClick', jobClickSchema);
