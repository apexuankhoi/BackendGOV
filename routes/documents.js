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

// === AI ===
router.get('/ai-report', authMiddleware, checkStaff, aiDocController.aiGenerateReport);
router.get('/ai-deadline-alerts', authMiddleware, checkStaff, aiDocController.getDeadlineAlerts);
router.post('/ai-upload', authMiddleware, checkStaff, uploadCloudinary.single('file'), aiDocController.aiReadUpload);
router.post('/ai-create-tasks', authMiddleware, checkStaff, aiDocController.aiCreateTasks);

// === CRUD Văn bản ===
router.get('/stats', authMiddleware, checkStaff, documentController.getStats);
router.get('/', authMiddleware, checkStaff, documentController.getDocuments);
router.post('/', authMiddleware, checkStaff, uploadCloudinary.array('files', 5), documentController.createDocument);

// Route động phải đặt dưới
router.get('/:id', authMiddleware, checkStaff, documentController.getDocument);
router.put('/:id', authMiddleware, checkStaff, documentController.updateDocument);
router.delete('/:id', authMiddleware, checkAdmin, documentController.deleteDocument);
router.post('/:id/dispatch', authMiddleware, checkStaff, documentController.dispatchDocument);
router.post('/:id/ai-read', authMiddleware, checkStaff, aiDocController.aiReadDocument);

// === AI Chat ===
const aiChatController = require('../controllers/aiChatController');
router.get('/:id/chat', authMiddleware, checkStaff, aiChatController.getChatHistory);
router.post('/:id/chat', authMiddleware, checkStaff, aiChatController.sendChatMessage);
router.delete('/:id/chat', authMiddleware, checkStaff, aiChatController.clearChatHistory);

// === AI Advanced (GD 6-9) ===
const aiAdvanced = require('../controllers/aiAdvancedController');
router.post('/ai-create-outgoing', authMiddleware, checkStaff, aiAdvanced.createOutgoingFromAI);
router.post('/:id/ai-approve', authMiddleware, checkAdmin, aiAdvanced.approveDocument);
router.post('/:id/ai-proofread', authMiddleware, checkStaff, aiAdvanced.aiProofread);
router.post('/ai-synthesize', authMiddleware, checkStaff, aiAdvanced.aiSynthesizeMultiple);
router.post('/ai-query', authMiddleware, checkStaff, aiAdvanced.aiNaturalQuery);
router.get('/ai-kpi', authMiddleware, checkAdmin, aiAdvanced.getStaffKPI);
router.get('/ai-kpi-evaluate', authMiddleware, checkAdmin, aiAdvanced.aiEvaluateKPI);
router.get('/ai-cross-agency', authMiddleware, checkStaff, aiAdvanced.crossAgencySynthesis);

module.exports = router;
