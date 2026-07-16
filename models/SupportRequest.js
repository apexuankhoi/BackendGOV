const mongoose = require('mongoose');

const supportRequestSchema = new mongoose.Schema({
  // Thông tin người gửi (bà con)
  senderName: { type: String, required: true },          // Họ tên
  senderPhone: { type: String, required: true },          // Số điện thoại
  senderAddress: { type: String },                         // Địa chỉ cụ thể

  // Phân loại & Nội dung
  category: { 
    type: String, 
    enum: [
      'THIEN_TAI',        // Thiên tai (bão, lụt, sạt lở...)
      'DOI_SONG',         // Đời sống khó khăn
      'Y_TE',             // Y tế, sức khỏe
      'GIAO_DUC',         // Giáo dục
      'HA_TANG',          // Hạ tầng (đường, điện, nước)
      'AN_NINH',          // An ninh trật tự
      'KHAC'              // Khác
    ],
    default: 'KHAC'
  },
  content: { type: String, required: true },              // Mô tả chi tiết nội dung cần hỗ trợ
  urgency: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM' 
  },

  // Hình ảnh đính kèm (base64 hoặc URL)
  photos: [{ type: String }],

  // Định tuyến đến xã
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },

  // Trạng thái xử lý
  status: { 
    type: String, 
    enum: ['NEW', 'RECEIVED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
    default: 'NEW'
  },

  // Phân công xử lý
  assignedTo: { type: String },                           // Tên đoàn viên/người được phân công
  assignedPhone: { type: String },                        // SĐT người được phân công
  assignedAt: { type: Date },

  // Kết quả xử lý
  resolution: { type: String },                           // Ghi chú kết quả hỗ trợ
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Báo cáo chi tiết khi hoàn thành (xã nộp)
  report: {
    volunteersCount: { type: Number, default: 0 },        // Số đoàn viên đã cử
    hoursWorked: { type: Number, default: 0 },             // Số giờ làm việc
    materialsUsed: { type: String },                       // Vật tư sử dụng
    beneficiariesCount: { type: Number, default: 0 },      // Số người được hỗ trợ
    satisfactionRating: { type: Number, min: 1, max: 5 },  // Đánh giá mức hài lòng (1-5)
    notes: { type: String },                               // Ghi chú thêm
  },

  // Lý do từ chối (nếu có)
  rejectionReason: { type: String },

  // Mã tra cứu cho bà con
  trackingCode: { type: String, unique: true },

  // User gửi (nếu đã đăng nhập, không bắt buộc vì public form)
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index cho tra cứu
supportRequestSchema.index({ agencyId: 1, status: 1 });
supportRequestSchema.index({ trackingCode: 1 });
supportRequestSchema.index({ senderPhone: 1 });
supportRequestSchema.index({ createdAt: -1 });

// Tự sinh mã tra cứu trước khi lưu
supportRequestSchema.pre('save', function(next) {
  if (!this.trackingCode) {
    // Format: HT-YYYYMMDD-XXXXX (HT = Hỗ Trợ)
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    this.trackingCode = `HT-${dateStr}-${random}`;
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SupportRequest', supportRequestSchema);
