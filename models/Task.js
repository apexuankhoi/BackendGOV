const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  // E-Government Tenant
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', default: null },

  // Thông tin công việc
  title: { type: String, required: true },
  description: { type: String, default: '' },

  // ===== PHÂN CẤP GIAO VIỆC & CHỈ ĐẠO THƯỜNG TRỰC TỈNH ĐOÀN =====
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Người chỉ đạo (Bí thư/Thường trực)
  
  // Lãnh đạo phụ trách trực tiếp (Phó Bí thư: A. Giang hoặc A. Pas)
  inChargeLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  
  // Ban / Phòng ban tham mưu chính
  advisoryDepartment: { 
    type: String, 
    enum: ['Ban Phong trào', 'Ban Tuyên giáo', 'Ban Tổ chức - Kiểm tra', 'Văn phòng', 'Ban TTN - Trường học', 'Cơ quan Tỉnh Đoàn', 'Khác'],
    default: 'Ban Phong trào' 
  },
  
  // Cán bộ / Đơn vị tham mưu chính (người nhận trách nhiệm chính)
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  advisoryOfficerName: { type: String, default: '' }, // Tên cán bộ tham mưu cụ thể (nếu có)
  
  // Đơn vị / Cán bộ phối hợp
  cooperatingUnits: { type: String, default: '' },
  
  // Giao lại (ủy quyền) - PBT giao cho Trưởng ban, Trưởng ban giao cho Cán bộ
  delegatedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Task cha (nếu đây là sub-task được giao lại)
  parentTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  // Cấp giao: 0=BT giao, 1=PBT giao, 2=Trưởng ban giao
  delegationLevel: { type: Number, default: 0, min: 0, max: 3 },
  // Người theo dõi
  watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // ================================

  // Thời hạn
  deadline: { type: Date },
  startDate: { type: Date, default: Date.now },

  // Màu sắc deadline (tính tự động: 🟢 Còn > 5 ngày, 🟡 Sắp hạn <= 5 ngày, 🔴 Quá hạn)
  deadlineColor: {
    type: String,
    enum: ['green', 'yellow', 'red', 'gray'],
    default: 'gray'
  },
  
  // Mức độ & Trạng thái
  priority: {
    type: String,
    enum: ['Thấp', 'Trung bình', 'Cao', 'Khẩn', 'Thượng khẩn'],
    default: 'Trung bình'
  },
  status: {
    type: String,
    enum: ['Chưa thực hiện', 'Đang thực hiện', 'Chờ duyệt', 'Hoàn thành', 'Quá hạn', 'Hủy'],
    default: 'Chưa thực hiện'
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },

  // ===== FILE ĐÍNH KÈM =====
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now }
  }],

  // ===== BÌNH LUẬN / CẬP NHẬT TIẾN ĐỘ =====
  comments: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    progressUpdate: { type: Number, default: null }, // % tiến độ khi comment
    createdAt: { type: Date, default: Date.now }
  }],

  // Liên kết với văn bản (nếu có)
  sourceDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  
  // AI
  aiGenerated: { type: Boolean, default: false },
  aiSolution: { type: String, default: '' },
  aiGeneratedFiles: [{
    fileName: String,
    filePath: String,
    fileType: String
  }],

  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Tự động tính màu deadline & cập nhật trạng thái quá hạn
taskSchema.pre('save', function() {
  this.updatedAt = new Date();

  // Tự động quá hạn
  if (this.deadline && new Date() > this.deadline && 
      !['Hoàn thành', 'Hủy'].includes(this.status)) {
    this.status = 'Quá hạn';
    this.deadlineColor = 'red';
  } else if (this.deadline && this.status !== 'Hoàn thành') {
    const daysLeft = Math.ceil((new Date(this.deadline) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) {
      this.deadlineColor = 'red';
    } else if (daysLeft <= 5) {
      this.deadlineColor = 'yellow';
    } else {
      this.deadlineColor = 'green';
    }
  } else if (this.status === 'Hoàn thành') {
    this.deadlineColor = 'green';
  }
});

// Index tìm kiếm nhanh
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ assignedBy: 1 });
taskSchema.index({ parentTask: 1 });
taskSchema.index({ deadline: 1 });

module.exports = mongoose.model('Task', taskSchema);
