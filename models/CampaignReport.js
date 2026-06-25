const mongoose = require('mongoose');

const campaignReportSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportDate: { type: Date, required: true }, // Ngày báo cáo (chuẩn hóa về 00:00:00 của ngày đó)
  
  // Dữ liệu từ form Phụ lục 2
  activeTeams: { type: Number, default: 0 },
  volunteers: { type: Number, default: 0 },
  digitalSkills: { type: Number, default: 0 },
  vneidSupport: { type: Number, default: 0 },
  publicServices: { type: Number, default: 0 },
  qrSupport: { type: Number, default: 0 },
  trainingClasses: { type: Number, default: 0 },
  digitalProducts: { type: Number, default: 0 },
  youthTrained: { type: Number, default: 0 },
  safetyCampaigns: { type: Number, default: 0 },
  mediaPosts: { type: Number, default: 0 },

  issues: { type: String }, // Khó khăn vướng mắc
  proposals: { type: String }, // Đề xuất
  evidenceLinks: { type: String }, // Link minh chứng

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Mỗi xã chỉ được gửi 1 báo cáo mỗi ngày (có thể update lại)
campaignReportSchema.index({ agencyId: 1, reportDate: 1 }, { unique: true });

module.exports = mongoose.model('CampaignReport', campaignReportSchema);
