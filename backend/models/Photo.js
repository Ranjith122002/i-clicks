const mongoose = require('mongoose');

const PhotoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  filename: {
    type: String,
    required: true
  },
  thumbnailFilename: {
    type: String
  },
  url: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  width: Number,
  height: Number,
  fileSize: Number,
  isFeatured: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  downloads: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  device: {
    type: String,
    default: 'iPhone'
  },
  location: String,
  shootDate: Date
}, {
  timestamps: true
});

PhotoSchema.index({ title: 'text', description: 'text', tags: 'text' });
PhotoSchema.index({ category: 1 });
PhotoSchema.index({ isPublished: 1, createdAt: -1 });

module.exports = mongoose.model('Photo', PhotoSchema);
