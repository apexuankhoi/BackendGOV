const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  // Loại văn bản: đến hoặc đi
  type: {
    type: String,
    enum: ['INCOMING', 'OUTGOING'],
    required: true
  },

  // Thông tin văn bản
  documentNumber: { type: String, default: '' },        // Số văn bản (VD: 125/KH-CAX)
  issuedDate: { type: Date },                           // Ngày ban hành
  receivedDate: { type: Date, default: Date.now },      // Ngày đến (VB đến) / Ngày gửi (VB đi)
  
  // Cơ quan / Đơn vị
  issuingAgency: { type: String, default: '' },          // Cơ quan ban hành
  receivingAgency: { type: String, default: '' },        // Nơi nhận (VB đi)
  signer: { type: String, default: '' },                 // Người ký
  signerTitle: { type: String, default: '' },            // Chức vụ người ký

  // Nội dung
  summary: { type: String, default: '' },                // Trích yếu nội dung
  category: {                                            // Loại văn bản
    type: String,
    enum: ['Công văn', 'Báo cáo', 'Kế hoạch', 'Tờ trình', 'Thông báo', 'Quyết định', 'Giấy mời', 'Chỉ thị', 'Hướng dẫn', 'Khác'],
    default: 'Công văn'
  },
  field: { type: String, default: '' },                  // Lĩnh vực (ANTT, Cư trú, Đề án 06...)

  // Độ ưu tiên & bảo mật
  urgency: {
    type: String,
    enum: ['Thường', 'Khẩn', 'Thượng khẩn', 'Hỏa tốc'],
    default: 'Thường'
  },
  securityLevel: {
    type: String,
    enum: ['Thường', 'Mật', 'Tối mật', 'Tuyệt mật'],
    default: 'Thường'
  },

  // Xử lý
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // Người xử lý
  deadline: { type: Date },                               // Hạn xử lý
  status: {
    type: String,
    enum: ['Chờ xử lý', 'Đang xử lý', 'Hoàn thành', 'Quá hạn', 'Trả lại'],
    default: 'Chờ xử lý'
  },

  // File đính kèm
  attachments: [{
    originalName: String,
    fileName: String,
    filePath: String,
    fileSize: Number,
    mimeType: String,
    uploadedAt: { type: Date, default: Date.now }
  }],

  // AI
  ocrContent: { type: String, default: '' },              // Nội dung OCR từ PDF/ảnh
  aiSuggestion: { type: String, default: '' },            // Đề xuất xử lý từ AI
  aiExtracted: { type: Boolean, default: false },         // Đã qua AI trích xuất chưa

  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Tự cập nhật updatedAt
documentSchema.pre('save', async function() {
  this.updatedAt = new Date();
});

module.exports = mongoose.model('Document', documentSchema);
