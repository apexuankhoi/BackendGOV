const mongoose = require('mongoose');

const smartwebRegistrationSchema = new mongoose.Schema({
  // Thông tin tiểu thương / thanh niên
  ownerName: { type: String, required: true },        // Họ tên chủ hộ
  phone: { type: String, required: true },             // Số điện thoại
  address: { type: String },                           // Địa chỉ cơ sở kinh doanh

  // Thông tin kinh doanh
  businessName: { type: String, required: true },      // Tên cơ sở / gian hàng
  businessType: {
    type: String,
    enum: [
      'BAN_LE',           // Bán lẻ tạp hóa
      'NONG_SAN',         // Nông sản, thực phẩm
      'AN_UONG',          // Ăn uống, quán ăn
      'THOI_TRANG',       // Thời trang, quần áo
      'DICH_VU',          // Dịch vụ (sửa chữa, cắt tóc...)
      'THU_CONG',         // Thủ công mỹ nghệ
      'KHAC'              // Khác
    ],
    default: 'KHAC'
  },

  // Thuộc đơn vị xã nào
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },

  // Trạng thái đăng ký
  status: {
    type: String,
    enum: [
      'PENDING',      // Đã đăng ký, chờ hỗ trợ
      'CONTACTED',    // Đã liên hệ, đang tư vấn
      'REGISTERED',   // Đã đăng ký tên miền .VN
      'ACTIVE',       // Website đã hoạt động
      'CANCELLED'     // Hủy / Không có nhu cầu
    ],
    default: 'PENDING'
  },

  // Thông tin website sau khi được hỗ trợ
  domain: { type: String },                            // Tên miền đã đăng ký (vd: hoatuoi-bmtuot.vn)
  websiteUrl: { type: String },                        // URL website thực tế
  registeredAt: { type: Date },                        // Ngày đăng ký tên miền

  // Người hỗ trợ (Đoàn viên được phân công)
  supportedBy: { type: String },                       // Tên đoàn viên hỗ trợ
  supportedPhone: { type: String },

  // Ghi chú
  notes: { type: String },

  // Mã tra cứu
  trackingCode: { type: String, unique: true },

  // Người tạo (nếu cán bộ nhập thay)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index tìm kiếm
smartwebRegistrationSchema.index({ agencyId: 1, status: 1 });
smartwebRegistrationSchema.index({ phone: 1 });
smartwebRegistrationSchema.index({ createdAt: -1 });

// Tự sinh mã tra cứu
smartwebRegistrationSchema.pre('save', function() {
  if (!this.trackingCode) {
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    this.trackingCode = `SW-${dateStr}-${random}`;
  }
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('SmartwebRegistration', smartwebRegistrationSchema);
