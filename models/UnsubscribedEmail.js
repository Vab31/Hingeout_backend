const mongoose = require('mongoose');

const unsubscribedEmailSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    reason: {
      type: String,
      default: 'user_requested_1click',
    },
    unsubscribedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.UnsubscribedEmail || mongoose.model('UnsubscribedEmail', unsubscribedEmailSchema);
