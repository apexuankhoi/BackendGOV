const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'webgov_secret_key_12345';

exports.register = async (req, res) => {
  try {
    const { username, email, password, role, province, district, commune } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email đã tồn tại' });
    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, email, password: hashed, role: role || 'CITIZEN', locationContext: { province, district, commune } });
    res.status(201).json({ message: 'Đăng ký thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Sai email hoặc mật khẩu' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Sai email hoặc mật khẩu' });
    const token = jwt.sign({ userId: user._id, role: user.role }, SECRET, { expiresIn: '15m' }); // Token sống 15 phút
    const refreshToken = jwt.sign({ userId: user._id, role: user.role }, SECRET, { expiresIn: '7d' }); // Refresh sống 7 ngày
    res.json({ token, refreshToken, role: user.role, username: user.username });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'Token is required' });
    
    jwt.verify(refreshToken, SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ message: 'Invalid refresh token' });
      
      const newToken = jwt.sign({ userId: decoded.userId, role: decoded.role }, SECRET, { expiresIn: '15m' });
      res.json({ token: newToken });
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
