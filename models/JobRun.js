const mongoose = require('mongoose');

const jobRunSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobSource',
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['RUNNING', 'COMPLETED', 'FAILED'],
      default: 'RUNNING',
    },
    jobsFound: {
      type: Number,
      default: 0,
    },
    jobsNew: {
      type: Number,
      default: 0,
    },
    jobsUpdated: {
      type: Number,
      default: 0,
    },
    jobsDuplicate: {
      type: Number,
      default: 0,
    },
    jobsExpired: {
      type: Number,
      default: 0,
    },
    jobsFailed: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

jobRunSchema.index({ sourceId: 1, startedAt: -1 });

module.exports = mongoose.model('JobRun', jobRunSchema);
