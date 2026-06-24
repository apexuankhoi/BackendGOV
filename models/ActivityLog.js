const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },       // VD: 'CREATE_DOCUMENT', 'UPDATE_TASK', 'AI_READ_PDF'
  target: { type: String, default: '' },           // VD: 'Văn bản #125/KH-CAX'
  details: { type: String, default: '' },          // Chi tiết bổ sung
  ip: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
