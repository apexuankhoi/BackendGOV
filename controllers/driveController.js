const SharedFile = require('../models/SharedFile');
const fs = require('fs');

// Lấy danh sách file/folder trong cơ quan
exports.getFiles = async (req, res) => {
  try {
    const isPersonal = req.query.isPersonal === 'true';
    const parentId = req.query.parentId || null;
    
    let filter = { parentId };
    if (isPersonal) {
      filter.uploadedBy = req.user.userId;
      filter.isPersonal = true;
    } else {
      if (!req.user.agencyId) return res.status(403).json({ message: 'Bạn chưa thuộc cơ quan nào để xem kho chung' });
      filter.agencyId = req.user.agencyId;
      filter.isPersonal = false;
    }

    const files = await SharedFile.find(filter)
      .populate('uploadedBy', 'username role')
      .sort({ isFolder: -1, updatedAt: -1 });

    // Fix broken absolute paths from previous uploads
    let needsUpdate = false;
    for (let f of files) {
      let changed = false;
      if (f.currentFile && f.currentFile.filePath && f.currentFile.filePath.includes('uploads')) {
        const parts = f.currentFile.filePath.replace(/\\/g, '/').split('uploads/');
        if (parts.length > 1 && f.currentFile.filePath !== 'uploads/' + parts[1]) {
          f.currentFile.filePath = 'uploads/' + parts[1];
          changed = true;
        }
      }
      if (f.versions && f.versions.length > 0) {
        for (let v of f.versions) {
          if (v.filePath && v.filePath.includes('uploads')) {
            const parts = v.filePath.replace(/\\/g, '/').split('uploads/');
            if (parts.length > 1 && v.filePath !== 'uploads/' + parts[1]) {
              v.filePath = 'uploads/' + parts[1];
              changed = true;
            }
          }
        }
      }
      if (changed) {
        await f.save();
        needsUpdate = true;
      }
    }
      
    res.json(files);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tải Drive', error: err.message });
  }
};

// Tạo thư mục mới
exports.createFolder = async (req, res) => {
  try {
    const { title, parentId, isPersonal } = req.body;
    const folder = await SharedFile.create({
      title,
      isFolder: true,
      parentId: parentId || null,
      agencyId: req.user.agencyId || null,
      uploadedBy: req.user.userId,
      isPersonal: isPersonal === true || isPersonal === 'true'
    });
    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tạo thư mục', error: err.message });
  }
};

// Upload file mới
exports.uploadFile = async (req, res) => {
  try {
    const { parentId, isPersonal } = req.body;
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn file' });
    
    const newFile = await SharedFile.create({
      title: req.file.originalname,
      isFolder: false,
      parentId: parentId || null,
      agencyId: req.user.agencyId || null,
      uploadedBy: req.user.userId,
      isPersonal: isPersonal === true || isPersonal === 'true',
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
