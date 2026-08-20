const mongoose = require('mongoose');

const campaignReportSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportDate: { type: Date, required: true }, // Ngày báo cáo (chuẩn hóa về 00:00:00 của ngày đó)
  
  // 11 CHỈ TIÊU CHÍNH THỨC CỦA CHIẾN DỊCH
  digitalSkills: { type: Number, default: 0 },   // 1. Lượt người dân tiếp cận kỹ năng số (Mục tiêu: 100.000)
  vneidSupport: { type: Number, default: 0 },    // 2. Lượt hướng dẫn VNeID mức 2 & tiện ích số (Mục tiêu: 50.000)
  publicServices: { type: Number, default: 0 },  // 3. Lượt hỗ trợ DVC trực tuyến (Mục tiêu: 30.000)
  qrSupport: { type: Number, default: 0 },       // 4. Hộ KD / tiểu thương thanh toán QR (Mục tiêu: 10.000)
  activeTeams: { type: Number, default: 0 },     // 5. Đội hình "Thanh niên số" thành lập (Mục tiêu: 102 đội hình)
  trainingClasses: { type: Number, default: 0 }, // 6. Lớp/điểm tập huấn kỹ năng số (Mục tiêu: 500 lớp)
  digitalModels: { type: Number, default: 0 },   // 7. Mô hình điểm CĐS cấp xã/phường (Mục tiêu: 102 mô hình)
  digitalProducts: { type: Number, default: 0 }, // 8. Sản phẩm OCOP/địa phương số hóa (Mục tiêu: 1.000 SP)
  youthTrained: { type: Number, default: 0 },    // 9. Đoàn viên TN tập huấn AI & kỹ năng số (Mục tiêu: 20.000 ĐV)
  youthProjects: { type: Number, default: 0 },   // 10. Công trình thanh niên CĐS (Mục tiêu: 102 công trình)
  smartwebCount: { type: Number, default: 0 },   // 11. Website SmartWeb / CĐS cho HKD, HTX (Mục tiêu: 102 website)

  // Số liệu bổ trợ khác
  websitesCreated: { type: Number, default: 0 }, // Số website đã active thực tế
  volunteers: { type: Number, default: 0 },      // Lượt tình nguyện viên / đoàn viên
  safetyCampaigns: { type: Number, default: 0 }, // Buổi tuyên truyền an toàn số
  mediaPosts: { type: Number, default: 0 },      // Tin bài / video truyền thông

  issues: { type: String }, // Khó khăn vướng mắc
  proposals: { type: String }, // Đề xuất
  evidenceLinks: { type: String, required: [true, 'Link minh chứng là bắt buộc'] }, // Link minh chứng (BẮT BUỘC)
  reporterName: { type: String, default: '' }, // Snapshot tên người nộp — không bị mất dù xoá account

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Mỗi xã chỉ được gửi 1 báo cáo mỗi ngày (có thể update lại)
campaignReportSchema.index({ agencyId: 1, reportDate: 1 }, { unique: true });

module.exports = mongoose.model('CampaignReport', campaignReportSchema);
