const mongoose = require('mongoose');

const fileVersionSchema = new mongoose.Schema({
  fileName: String,
  filePath: String,
  mimeType: String,
  size: Number,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
  note: String
});

const sharedFileSchema = new mongoose.Schema({
  // Ten hien thi tren Drive
  title: { type: String, required: true },
  
  // File hien tai (phien ban moi nhat)
  currentFile: {
    fileName: String,
    filePath: String,
    mimeType: String,
    size: Number
  },
  
  // Nguoi tao & Co quan so huu
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', default: null }, // Optional for citizens
  isPersonal: { type: Boolean, default: false }, // Danh dau Kho du lieu ca nhan
  
  // Thu muc cha (null = thu muc goc)
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SharedFile', default: null },
  isFolder: { type: Boolean, default: false },
  
  // Lich su cac phien ban truoc do
  versions: [fileVersionSchema],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SharedFile', sharedFileSchema);
