const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, trim: true, maxlength: 500 },
  tags: [{ type: String, trim: true, lowercase: true }],
  location: { type: String, trim: true },
  device: { type: String, default: 'iPhone' },
  filename: { type: String, required: true },
  url: { type: String, required: true },
  thumbnailUrl: { type: String },
  width: Number,
  height: Number,
  fileSize: Number,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNote: { type: String }, // reason for rejection
  reviewedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Submission', SubmissionSchema);
