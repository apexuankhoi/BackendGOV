const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Tên đội hình
  schoolOrUnit: { type: String, required: true }, // Tên trường/đơn vị
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // ID của User (Thành viên/Xã) tạo
  
  fieldsOfActivity: [{ type: String }], // Các lĩnh vực hoạt động (Môi trường, Y tế...)
  
  // Địa điểm triển khai (Ràng buộc vào Đắk Lắk)
  location: {
    province: { type: String, default: 'Đắk Lắk' },
    district: { type: String, required: true },
    commune: { type: String, required: true },
    type: { type: String, enum: ['Nông thôn', 'Đô thị'] }
  },
  
  timeframe: {
    startDate: { type: Date },
    endDate: { type: Date }
  },
  
  // Báo cáo số liệu chỉ tiêu
  statistics: {
    volunteersCount: { type: Number, default: 0 }, // Số tình nguyện viên
    projectsCount: { type: Number, default: 0 },   // Số công trình
    estimatedValue: { type: Number, default: 0 },  // Giá trị làm lợi (triệu VNĐ)
    beneficiaries: { type: Number, default: 0 }    // Số người thụ hưởng
  },
  
  // Báo cáo số liệu chỉ tiêu & Minh chứng
  evidenceLinks: { type: String, default: '' }, // Link minh chứng Google Drive / Ảnh / Bài viết
  reporterName: { type: String, default: '' },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' },
  kpiSummary: {
    digitalSkills: { type: Number, default: 0 },
    vneidSupport: { type: Number, default: 0 },
    publicServices: { type: Number, default: 0 },
    qrSupport: { type: Number, default: 0 },
    smartwebCount: { type: Number, default: 0 }
  },

  // Trạng thái kiểm duyệt (Luồng phê duyệt)
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING' // Mặc định là chờ Tỉnh duyệt
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Team', teamSchema);
