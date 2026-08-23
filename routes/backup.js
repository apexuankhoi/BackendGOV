const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');
const { runBackup, listBackups, BACKUP_DIR } = require('../utils/backup');

// Chỉ SENIOR_ADMIN mới được dùng backup API
const checkSenior = (req, res, next) => {
  if (!['SENIOR_ADMIN', 'PROVINCE_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Không có quyền' });
  }
  next();
};

// GET /api/backup - Danh sách backup
router.get('/', authMiddleware, checkSenior, (req, res) => {
  try {
    const backups = listBackups();
    res.json({ backups, count: backups.length, backupDir: BACKUP_DIR });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi đọc danh sách backup', error: err.message });
  }
});

// POST /api/backup/run - Chạy backup thủ công
router.post('/run', authMiddleware, checkSenior, async (req, res) => {
  try {
    console.log(`[Backup] 🔧 Backup thủ công bởi Admin: ${req.user.userId}`);
    const result = await runBackup();
    res.json({ message: result.success ? '✅ Backup thành công!' : '❌ Backup thất bại', ...result });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi backup', error: err.message });
  }
});

module.exports = router;
