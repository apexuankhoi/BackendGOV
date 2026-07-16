const express = require('express');
const router = express.Router();
const controller = require('../controllers/supportRequestController');
const authMiddleware = require('../middleware/authMiddleware');

// ═══════════════════════════════════════════════════
//  PUBLIC routes (bà con không cần đăng nhập)
// ═══════════════════════════════════════════════════

// Lấy danh sách xã/phường để hiển thị dropdown
router.get('/communes', controller.getCommunes);

// Gửi yêu cầu hỗ trợ (public)
router.post('/submit', controller.submitRequest);

// Tra cứu trạng thái bằng mã hoặc SĐT
router.get('/track', controller.trackRequest);

// ═══════════════════════════════════════════════════
//  ADMIN routes (cần đăng nhập)
// ═══════════════════════════════════════════════════

// Lấy danh sách yêu cầu (cấp xã thấy của mình, cấp tỉnh thấy tất cả)
router.get('/', authMiddleware, controller.getRequests);

// Thống kê tổng hợp
router.get('/stats', authMiddleware, controller.getStats);

// Cập nhật trạng thái yêu cầu
router.put('/:id', authMiddleware, controller.updateRequest);

module.exports = router;
