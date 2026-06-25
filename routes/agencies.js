const express = require('express');
const router = express.Router();
const Agency = require('../models/Agency');
const authMiddleware = require('../middleware/authMiddleware');

// GET all agencies
router.get('/', authMiddleware, async (req, res) => {
  try {
    const agencies = await Agency.find().populate('parentAgency', 'name level').sort({ level: 1, name: 1 });
    res.json(agencies);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tải danh sách cơ quan', error: err.message });
  }
});

// POST create agency (admin only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (!['ADMIN', 'SENIOR_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Không có quyền' });
    }
    const { name, level, parentAgencyId, description } = req.body;
    const agency = await Agency.create({ name, level, parentAgency: parentAgencyId || null, description });
    res.status(201).json(agency);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tạo cơ quan', error: err.message });
  }
});

// DELETE agency (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (!['ADMIN', 'SENIOR_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Không có quyền' });
    }
    await Agency.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa cơ quan' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xóa cơ quan', error: err.message });
  }
});

module.exports = router;
