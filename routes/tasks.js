const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authMiddleware = require('../middleware/authMiddleware');

const checkStaff = (req, res, next) => {
  const staffRoles = ['COMMUNE_ADMIN', 'PROVINCE_ADMIN', 'ADMIN', 'SENIOR_ADMIN'];
  if (!staffRoles.includes(req.user.role)) return res.status(403).json({ message: 'Không có quyền' });
  next();
};

const checkAdmin = (req, res, next) => {
  if (!['ADMIN', 'SENIOR_ADMIN', 'PROVINCE_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Không có quyền' });
  }
  next();
};

const checkSenior = (req, res, next) => {
  if (!['SENIOR_ADMIN', 'PROVINCE_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Không có quyền' });
  }
  next();
};

const aiDocController = require('../controllers/aiDocController');

// ===== TASK ROUTES =====
router.get('/', authMiddleware, checkStaff, taskController.getTasks);
router.get('/overdue', authMiddleware, checkStaff, taskController.getOverdueTasks);
router.get('/stats', authMiddleware, checkStaff, taskController.getTaskStats);
router.get('/dashboard', authMiddleware, checkAdmin, taskController.getTaskDashboard);  // Bí thư xem tổng quan

router.post('/', authMiddleware, checkStaff, taskController.createTask);
router.put('/:id', authMiddleware, checkStaff, taskController.updateTask);
router.delete('/:id', authMiddleware, checkAdmin, taskController.deleteTask);

// Ủy quyền / Giao lại
router.post('/:id/delegate', authMiddleware, checkStaff, taskController.delegateTask);

// Bình luận & Cập nhật tiến độ
router.post('/:id/comment', authMiddleware, checkStaff, taskController.addComment);

// Duyệt hoàn thành (chỉ người giao hoặc cấp trên)
router.post('/:id/approve', authMiddleware, checkStaff, taskController.approveTask);

// AI Solve
router.post('/:id/ai-solve', authMiddleware, checkStaff, aiDocController.aiSolveTask);

// === AI Chat ===
const aiChatController = require('../controllers/aiChatController');
router.get('/:id/chat', authMiddleware, checkStaff, aiChatController.getChatHistory);
router.post('/:id/chat', authMiddleware, checkStaff, aiChatController.sendChatMessage);
router.delete('/:id/chat', authMiddleware, checkStaff, aiChatController.clearChatHistory);

module.exports = router;

