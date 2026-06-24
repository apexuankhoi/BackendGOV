const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// Chỉ staff mới được xem danh sách
const checkStaff = (req, res, next) => {
  const staffRoles = ['COMMUNE_ADMIN', 'PROVINCE_ADMIN', 'ADMIN', 'SENIOR_ADMIN'];
  if (!staffRoles.includes(req.user.role)) return res.status(403).json({ message: 'Không có quyền' });
  next();
};

// Chỉ SENIOR_ADMIN mới được tạo/xóa
const checkSenior = (req, res, next) => {
  if (req.user.role !== 'SENIOR_ADMIN') return res.status(403).json({ message: 'Không có quyền' });
  next();
};

const { uploadCloudinary } = require('../config/cloudinary');

router.get('/', authMiddleware, checkStaff, userController.getUsers);
router.post('/', authMiddleware, checkSenior, userController.createUser);
router.delete('/:id', authMiddleware, checkSenior, userController.deleteUser);
router.post('/:id/avatar', authMiddleware, uploadCloudinary.single('avatar'), userController.uploadAvatar);

module.exports = router;
