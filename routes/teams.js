const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const authMiddleware = require('../middleware/authMiddleware');

// Middleware kiểm tra quyền phê duyệt (chỉ Tỉnh + Super Admin)
const checkApprover = (req, res, next) => {
  if (req.user.role !== 'PROVINCE_ADMIN' && req.user.role !== 'SENIOR_ADMIN') {
    return res.status(403).json({ message: 'Không đủ quyền phê duyệt' });
  }
  next();
};

// Public route: Lấy danh sách đội hình (sẽ tự động filter status=APPROVED trong controller)
router.get('/', teamController.getTeams);

// Authenticated route: Lấy danh sách đội hình (có req.user để xem tất cả status)
router.get('/admin', authMiddleware, teamController.getTeams);

// Các route bên dưới cần đăng nhập
router.post('/', authMiddleware, teamController.createTeam);

// Tỉnh duyệt — BẮT BUỘC kiểm tra Role
router.put('/:id/approve', authMiddleware, checkApprover, teamController.approveTeam);

module.exports = router;
