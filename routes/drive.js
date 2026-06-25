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
router.post('/upload', authMiddleware, checkAgency, uploadCloudinary.single('file'), driveController.uploadFile);
router.post('/:id/new-version', authMiddleware, checkAgency, uploadCloudinary.single('file'), driveController.uploadNewVersion);
router.delete('/:id', authMiddleware, checkAgency, driveController.deleteFile);

module.exports = router;
