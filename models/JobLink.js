const mongoose = require('mongoose');

const jobLinkSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [200, 'Title must be under 200 characters'],
    },

    url: {
      type: String,
      required: [true, 'Job URL is required'],
      trim: true,
    },

    company: {
      type: String,
      trim: true,
      default: '',
    },

    jobType: {
      type: String,
      enum: ['full-time', 'part-time', 'internship', 'remote', 'freelance', 'contract', 'any'],
      default: 'any',
    },

    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description must be under 1000 characters'],
      default: '',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

jobLinkSchema.index({ jobType: 1 });
jobLinkSchema.index({ isActive: 1 });

module.exports = mongoose.model('JobLink', jobLinkSchema);
