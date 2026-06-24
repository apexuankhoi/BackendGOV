const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  // Thông tin công việc
  title: { type: String, required: true },                // Tên công việc
  description: { type: String, default: '' },             // Mô tả chi tiết

  // Người liên quan
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // Người giao
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },                  // Người thực hiện

  // Thời hạn
  deadline: { type: Date },
  
  // Mức độ & Trạng thái
  priority: {
    type: String,
    enum: ['Thấp', 'Trung bình', 'Cao', 'Rất cao'],
    default: 'Trung bình'
  },
  status: {
    type: String,
    enum: ['Chưa thực hiện', 'Đang thực hiện', 'Hoàn thành', 'Quá hạn', 'Hủy'],
    default: 'Chưa thực hiện'
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },  // % tiến độ

  // Liên kết với văn bản (nếu có)
  sourceDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  
  // AI
  aiGenerated: { type: Boolean, default: false },         // Được AI tạo?
  aiSolution: { type: String, default: '' },              // AI giải quyết hộ
  
  // Metadata
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

taskSchema.pre('save', async function() {
  this.updatedAt = new Date();
  // Tự đánh dấu quá hạn
  if (this.deadline && new Date() > this.deadline && this.status !== 'Hoàn thành' && this.status !== 'Hủy') {
    this.status = 'Quá hạn';
  }
});

module.exports = mongoose.model('Task', taskSchema);
