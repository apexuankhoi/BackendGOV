const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// In-memory store for now (in production, store in DB/env file)
let currentAiToken = process.env.GITHUB_TOKEN || '';

const checkSenior = (req, res, next) => {
  if (req.user.role !== 'SENIOR_ADMIN') return res.status(403).json({ message: 'Không đủ quyền hạn' });
  next();
};

// Update AI Token
router.post('/ai-token', authMiddleware, checkSenior, (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'Token không được để trống' });
  currentAiToken = token;
  process.env.GITHUB_TOKEN = token; // Update runtime env
  res.json({ message: 'Cập nhật Token AI thành công' });
});

// Expose token getter for aiController
router.getToken = () => currentAiToken;

module.exports = router;
