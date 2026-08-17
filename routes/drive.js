const express = require('express');
const router = express.Router();
const driveController = require('../controllers/driveController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadCloudinary } = require('../config/cloudinary');

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

router.get('/', authMiddleware, driveController.getFiles);
router.post('/folder', authMiddleware, driveController.createFolder);
router.post('/upload', authMiddleware, handleUpload, driveController.uploadFile);
router.post('/:id/new-version', authMiddleware, handleUpload, driveController.uploadNewVersion);
router.delete('/:id', authMiddleware, driveController.deleteFile);

module.exports = router;
