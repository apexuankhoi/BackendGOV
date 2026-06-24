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
  if (req.user.role !== 'ADMIN' && req.user.role !== 'SENIOR_ADMIN') {
    return res.status(403).json({ message: 'Không có quyền' });
  }
  next();
};

const aiDocController = require('../controllers/aiDocController');

router.get('/', authMiddleware, checkStaff, taskController.getTasks);
router.get('/overdue', authMiddleware, checkStaff, taskController.getOverdueTasks);
router.get('/stats', authMiddleware, checkStaff, taskController.getTaskStats);
router.post('/', authMiddleware, checkStaff, taskController.createTask);
router.put('/:id', authMiddleware, checkStaff, taskController.updateTask);
router.delete('/:id', authMiddleware, checkAdmin, taskController.deleteTask);
router.post('/:id/ai-solve', authMiddleware, checkStaff, aiDocController.aiSolveTask);

module.exports = router;
