const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'campaign_reporting' },
  // Giờ mở cổng (mặc định '13:00')
  openTime: { type: String, default: '13:00' },
  // Giờ đóng cổng nhận báo cáo mới (mặc định '18:30')
  closeTime: { type: String, default: '18:30' },
  // Hạn chót cho phép xã chỉnh sửa số liệu sau khi nộp (mặc định '19:00')
  editDeadline: { type: String, default: '19:00' },
  // Luôn mở cổng (không giới hạn giờ, dành cho test hoặc tình huống khẩn cấp)
  alwaysOpen: { type: Boolean, default: false },
  // Thông báo tùy chỉnh
  customNotice: { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
