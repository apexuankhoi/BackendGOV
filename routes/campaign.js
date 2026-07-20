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
