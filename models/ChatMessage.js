const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  // Liên kết với văn bản hoặc công việc
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  
  // Người gửi
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Nội dung
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  
  // File AI sinh ra (nếu có)
  generatedFile: {
    fileName: String,
    filePath: String,
    fileType: String
  },
  
  createdAt: { type: Date, default: Date.now }
});

// Index để query nhanh theo document/task
chatMessageSchema.index({ documentId: 1, createdAt: 1 });
chatMessageSchema.index({ taskId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
