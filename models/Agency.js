const mongoose = require('mongoose');

const agencySchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "UBND Tỉnh Đắk Lắk", "UBND Phường Ea Tam"
  level: { type: String, enum: ['PROVINCE', 'DISTRICT', 'COMMUNE', 'MINISTRY'], required: true },
  parentAgency: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', default: null }, // Link Xã -> Tỉnh
  description: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Agency', agencySchema);
