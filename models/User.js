const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // E-Government Tenant
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', default: null },
  
  // Áp dụng kiến trúc 5 Roles
  role: { 
    type: String, 
    enum: ['CITIZEN', 'COMMUNE_ADMIN', 'PROVINCE_ADMIN', 'ADMIN', 'SENIOR_ADMIN'],
    default: 'CITIZEN'
  },
  
  // Quản lý dữ liệu phân cấp Xã/Tỉnh
  locationContext: {
    province: { type: String, default: 'Đắk Lắk' },
    district: { type: String }, // Huyện/Thị xã
    commune: { type: String }   // Xã/Phường
  },
  
  // Dữ liệu eKYC
  cccd: { type: String },
  dob: { type: String },
  address: { type: String },
  phone: { type: String },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
