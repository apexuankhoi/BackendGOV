const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route: Lấy số liệu tổng hợp toàn tỉnh
router.get('/stats', campaignController.getGlobalStats);

// Cấu hình khung giờ mở/đóng và hạn sửa báo cáo
router.get('/config', campaignController.getReportingConfig);
router.put('/config', authMiddleware, campaignController.updateReportingConfig);

// Protected routes (Dành cho cấp xã báo cáo & xem lại lịch sử các ngày)
router.post('/report', authMiddleware, campaignController.submitReport);
router.get('/report', authMiddleware, campaignController.getMyReport);
router.get('/my-history', authMiddleware, campaignController.getMyHistory);

// Danh sách tiến độ và link minh chứng 102 Xã/Phường
router.get('/communes-status', campaignController.getCommunesReportStatus);

// Dành cho cấp Tỉnh xem và quản lý
router.get('/all-reports', authMiddleware, campaignController.getAllReports);
router.delete('/report/:id', authMiddleware, campaignController.deleteReport);
router.put('/report/:id/agency', authMiddleware, campaignController.assignAgencyToReport);

// Xuất Excel báo cáo chiến dịch
router.get('/export-excel', authMiddleware, campaignController.exportExcel);

// Tổng kết DTI
router.get('/dti-summary', authMiddleware, campaignController.getDtiSummary);

// QR Code cho trang chiến dịch theo xã
router.get('/qr/:agencyId', authMiddleware, async (req, res) => {
  try {
    const QRCode = require('qrcode');
    const Agency = require('../models/Agency');
    const BASE_URL = process.env.FRONTEND_URL || 'https://webgov.daklak.gov.vn';
    const agency = await Agency.findById(req.params.agencyId).select('name');
    const url = `${BASE_URL}/chien-dich?agency=${req.params.agencyId}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#F59E0B', light: '#FFFFFF' } });
    res.json({ agencyName: agency?.name || 'Không rõ', qrDataUrl, registrationUrl: url });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tạo QR', error: err.message });
  }
});

module.exports = router;
