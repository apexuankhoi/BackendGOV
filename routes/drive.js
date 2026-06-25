const express = require('express');
const router = express.Router();
const driveController = require('../controllers/driveController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadCloudinary } = require('../config/cloudinary');

// Chỉ staff của cơ quan mới được vào (có agencyId)
const checkAgency = (req, res, next) => {
  if (!req.user.agencyId) return res.status(403).json({ message: 'Không có quyền truy cập Drive của cơ quan' });
  next();
};

router.get('/', authMiddleware, checkAgency, driveController.getFiles);
router.post('/folder', authMiddleware, checkAgency, driveController.createFolder);
// Wrapper để bắt lỗi multer (đặc biệt là Cloudinary)
const handleUpload = (req, res, next) => {
  uploadCloudinary.single('file')(req, res, function (err) {
    if (err) {
      console.error('Multer/Cloudinary Error:', err);
      return res.status(500).json({ message: 'Lỗi tải lên Cloudinary: ' + err.message });
    }
    next();
  });
};

router.post('/upload', authMiddleware, checkAgency, handleUpload, driveController.uploadFile);
router.post('/:id/new-version', authMiddleware, checkAgency, handleUpload, driveController.uploadNewVersion);
router.delete('/:id', authMiddleware, checkAgency, driveController.deleteFile);

module.exports = router;
