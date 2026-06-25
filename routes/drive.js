const express = require('express');
const router = express.Router();
const driveController = require('../controllers/driveController');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Tạo thư mục uploads/drive nếu chưa có
const driveUploadDir = path.join(__dirname, '..', 'uploads', 'drive');
if (!fs.existsSync(driveUploadDir)) {
  fs.mkdirSync(driveUploadDir, { recursive: true });
}

// Multer local storage cho Drive (không dùng Cloudinary)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, driveUploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const uploadLocal = multer({ storage });

// Chỉ staff của cơ quan mới được vào (có agencyId)
const checkAgency = (req, res, next) => {
  if (!req.user.agencyId) return res.status(403).json({ message: 'Không có quyền truy cập Drive của cơ quan' });
  next();
};

router.get('/', authMiddleware, checkAgency, driveController.getFiles);
router.post('/folder', authMiddleware, checkAgency, driveController.createFolder);
router.post('/upload', authMiddleware, checkAgency, uploadLocal.single('file'), driveController.uploadFile);
router.post('/:id/new-version', authMiddleware, checkAgency, uploadLocal.single('file'), driveController.uploadNewVersion);
router.delete('/:id', authMiddleware, checkAgency, driveController.deleteFile);

module.exports = router;
