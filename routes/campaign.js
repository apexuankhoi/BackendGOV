const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route: Lấy số liệu tổng hợp toàn tỉnh
router.get('/stats', campaignController.getGlobalStats);

// Protected routes (Dành cho cấp xã báo cáo)
router.post('/report', authMiddleware, campaignController.submitReport);
router.get('/report', authMiddleware, campaignController.getMyReport);

// Dành cho cấp Tỉnh xem
router.get('/all-reports', authMiddleware, campaignController.getAllReports);

module.exports = router;
