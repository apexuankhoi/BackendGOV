const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/smartwebController');
const authMiddleware = require('../middleware/authMiddleware');

// ─── PUBLIC (không cần token) ───────────────────────────
// Tiểu thương đăng ký
router.post('/register', ctrl.publicRegister);

// Tra cứu trạng thái theo mã
router.get('/track/:code', ctrl.trackStatus);

// Thống kê công khai (cho trang chủ counter)
router.get('/public-stats', ctrl.getPublicStats);

// ─── PROTECTED (cần đăng nhập) ──────────────────────────
// Lấy danh sách (Xã xem của mình, Tỉnh+ xem tất cả)
router.get('/', authMiddleware, ctrl.getAll);

// Thống kê SmartWeb
router.get('/stats', authMiddleware, ctrl.getStats);

// Tạo QR code cho điểm đăng ký
router.get('/qr/:agencyId', authMiddleware, ctrl.generateQR);

// Xuất Excel
router.get('/export', authMiddleware, ctrl.exportExcel);

// Cập nhật trạng thái
router.put('/:id', authMiddleware, ctrl.updateStatus);

module.exports = router;
