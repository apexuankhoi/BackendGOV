const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, email, password, role, province, district, commune } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'Email đã tồn tại' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      username, email, password: hashedPassword, role,
      locationContext: { province, district, commune }
    });
    
    await user.save();
    res.status(201).json({ message: 'Tạo tài khoản thành công', user: { _id: user._id, username, email, role } });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa người dùng' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Cập nhật Avatar (lấy URL từ Cloudinary)
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Không tìm thấy file ảnh' });
    }
    
    // req.file.path chính là URL trên Cloudinary trả về
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { avatar: req.file.path }, 
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi up ảnh', error: err.message });
  }
};
