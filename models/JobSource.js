const mongoose = require('mongoose');

const jobSourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Source name is required'],
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Associated company ID is required'],
    },
    type: {
      type: String,
      enum: [
        'COMPANY_CAREER_PAGE',
        'GREENHOUSE',
        'LEVER',
        'WORKDAY',
        'CUSTOM',
        'TELEGRAM',
        'MANUAL_URL',
        'API',
        'RSS',
      ],
      required: [true, 'Source type is required'],
    },
    url: {
      type: String,
      required: [true, 'Source URL is required'],
      trim: true,
    },
    extractionMethod: {
      type: String,
      enum: ['API', 'SCRAPER', 'AI_HEURISTIC'],
      default: 'API',
    },
    crawlFrequencyHours: {
      type: Number,
      default: 24,
    },
    autoPublish: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['HEALTHY', 'WARNING', 'FAILED', 'DISABLED'],
      default: 'HEALTHY',
    },
    lastCrawledAt: {
      type: Date,
      default: null,
    },
    lastSuccessAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

jobSourceSchema.index({ companyId: 1 });
jobSourceSchema.index({ active: 1, status: 1 });

module.exports = mongoose.model('JobSource', jobSourceSchema);
