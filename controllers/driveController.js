const SharedFile = require('../models/SharedFile');
const fs = require('fs');

// Lấy danh sách file/folder trong cơ quan
exports.getFiles = async (req, res) => {
  try {
    const { agencyId } = req.user;
    if (!agencyId) return res.status(403).json({ message: 'Bạn chưa thuộc cơ quan nào' });
    
    const parentId = req.query.parentId || null;
    const files = await SharedFile.find({ agencyId, parentId })
      .populate('uploadedBy', 'username role')
      .sort({ isFolder: -1, updatedAt: -1 });
      
    res.json(files);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tải Drive', error: err.message });
  }
};

// Tạo thư mục mới
exports.createFolder = async (req, res) => {
  try {
    const { title, parentId } = req.body;
    const folder = await SharedFile.create({
      title,
      isFolder: true,
      parentId: parentId || null,
      agencyId: req.user.agencyId,
      uploadedBy: req.user.userId
    });
    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tạo thư mục', error: err.message });
  }
};

// Upload file mới
exports.uploadFile = async (req, res) => {
  try {
    const { parentId } = req.body;
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn file' });
    
    const newFile = await SharedFile.create({
      title: req.file.originalname,
      isFolder: false,
      parentId: parentId || null,
      agencyId: req.user.agencyId,
      uploadedBy: req.user.userId,
      currentFile: {
        fileName: req.file.originalname,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });
    
    res.status(201).json(newFile);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi upload', error: err.message });
  }
};

// Cập nhật phiên bản mới (Versioning)
exports.uploadNewVersion = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn file' });
    const file = await SharedFile.findOne({ _id: req.params.id, agencyId: req.user.agencyId });
    if (!file || file.isFolder) return res.status(404).json({ message: 'Không tìm thấy file' });
    
    // Lưu bản cũ vào versions
    file.versions.push({
      ...file.currentFile,
      uploadedBy: file.uploadedBy,
      uploadedAt: file.updatedAt,
      note: req.body.note || 'Cập nhật phiên bản mới'
    });
    
    // Cập nhật bản mới
    file.currentFile = {
      fileName: req.file.originalname,
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      size: req.file.size
    };
    file.uploadedBy = req.user.userId;
    file.updatedAt = new Date();
    
    await file.save();
    res.json(file);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi cập nhật version', error: err.message });
  }
};

// Xóa file/folder
exports.deleteFile = async (req, res) => {
  try {
    const file = await SharedFile.findOneAndDelete({ _id: req.params.id, agencyId: req.user.agencyId });
    if (!file) return res.status(404).json({ message: 'Không tìm thấy' });
    res.json({ message: 'Đã xóa thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xóa', error: err.message });
  }
};
