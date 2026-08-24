const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const checkStaff = (req, res, next) => {
  const staffRoles = ['COMMUNE_ADMIN', 'PROVINCE_ADMIN', 'ADMIN', 'SENIOR_ADMIN'];
  if (!staffRoles.includes(req.user.role)) return res.status(403).json({ message: 'Không có quyền' });
  next();
};

const checkSenior = (req, res, next) => {
  if (req.user.role !== 'SENIOR_ADMIN') return res.status(403).json({ message: 'Không có quyền' });
  next();
};

const { uploadCloudinary } = require('../config/cloudinary');

router.get('/', authMiddleware, checkStaff, userController.getUsers);
router.get('/staff', authMiddleware, checkStaff, userController.getStaffList);
router.post('/', authMiddleware, checkSenior, userController.createUser);
router.delete('/:id', authMiddleware, checkSenior, userController.deleteUser);
router.post('/:id/avatar', authMiddleware, uploadCloudinary.single('avatar'), userController.uploadAvatar);
router.put('/:id/position', authMiddleware, checkSenior, userController.updateUserPosition);

// Gán Agency cho User (Admin tỉnh fix thủ công)
router.patch('/:id/agency', authMiddleware, checkSenior, userController.assignAgency);

// Cập nhật thông tin cơ bản (username, email) — dùng khi fix zombie
router.patch('/:id', authMiddleware, checkSenior, async (req, res) => {
  try {
    const { username, email } = req.body;
    const User = require('../models/User');
    const update = {};
    if (username) update.username = username;
    if (email) update.email = email;
    if (!Object.keys(update).length) return res.status(400).json({ message: 'Không có gì để cập nhật' });
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    res.json({ message: 'Cập nhật thành công', user });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi cập nhật: ' + err.message });
  }
});

// Tự động sửa tất cả User thiếu agencyId (Admin chạy 1 lần)
router.post('/auto-fix-agencies', authMiddleware, checkSenior, userController.autoFixAllAgencies);


module.exports = router;
