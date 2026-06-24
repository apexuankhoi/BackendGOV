const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const documentController = require('../controllers/documentController');
const aiDocController = require('../controllers/aiDocController');
const authMiddleware = require('../middleware/authMiddleware');

const { uploadCloudinary } = require('../config/cloudinary');

// Chỉ staff mới vào được
const checkStaff = (req, res, next) => {
  const staffRoles = ['COMMUNE_ADMIN', 'PROVINCE_ADMIN', 'ADMIN', 'SENIOR_ADMIN'];
  if (!staffRoles.includes(req.user.role)) return res.status(403).json({ message: 'Không có quyền' });
  next();
};

const checkAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'SENIOR_ADMIN') {
    return res.status(403).json({ message: 'Không có quyền' });
  }
  next();
};

// === CRUD Văn bản ===
router.get('/stats', authMiddleware, checkStaff, documentController.getStats);
router.get('/', authMiddleware, checkStaff, documentController.getDocuments);
router.get('/:id', authMiddleware, checkStaff, documentController.getDocument);
router.post('/', authMiddleware, checkStaff, uploadCloudinary.array('files', 5), documentController.createDocument);
router.put('/:id', authMiddleware, checkStaff, documentController.updateDocument);
router.delete('/:id', authMiddleware, checkAdmin, documentController.deleteDocument);

// === AI ===
router.post('/ai-upload', authMiddleware, checkStaff, uploadCloudinary.single('file'), aiDocController.aiReadUpload);
router.post('/ai-create-tasks', authMiddleware, checkStaff, aiDocController.aiCreateTasks);
router.post('/:id/ai-read', authMiddleware, checkStaff, aiDocController.aiReadDocument);

module.exports = router;
