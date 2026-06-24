const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const authMiddleware = require('../middleware/authMiddleware');

const checkAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'SENIOR_ADMIN') {
    return res.status(403).json({ message: 'Không có quyền' });
  }
  next();
};

router.get('/', authMiddleware, checkAdmin, activityLogController.getLogs);

module.exports = router;
