const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  summary: { type: String },
  content: { type: String, required: true },
  imageUrl: { type: String },
  category: { type: String, default: 'Chuyển đổi số' },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  views: { type: Number, default: 120 },
  // Facebook import fields
  sourceUrl: { type: String, default: null },
  sourceType: { type: String, enum: ['manual', 'facebook', 'web'], default: 'manual' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('News', newsSchema);
