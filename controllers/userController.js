const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').populate('agencyId', 'name level');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy danh sách cán bộ để giao việc (phân cấp thông minh: Thường trực, Cán bộ cơ quan tỉnh, Cán bộ xã)
exports.getStaffList = async (req, res) => {
  try {
    const { scope } = req.query; // 'province' | 'all'
    const staffRoles = ['COMMUNE_ADMIN', 'PROVINCE_ADMIN', 'ADMIN', 'SENIOR_ADMIN'];
    
    let query = { role: { $in: staffRoles } };
    if (scope === 'province') {
      // Chỉ lấy Thường trực và Cán bộ Cơ quan cấp Tỉnh (không lấy 102 xã)
      query.role = { $in: ['SENIOR_ADMIN', 'PROVINCE_ADMIN', 'ADMIN'] };
    }

    const users = await User.find(query)
      .select('username email role position department positionLabel agencyId phone')
      .populate('agencyId', 'name level')
      .sort({ role: 1, position: 1, username: 1 });

    // Phân loại nhóm sẵn cho Frontend
    const deputies = users.filter(u => u.position === 'PHO_BI_THU' || u.role === 'PROVINCE_ADMIN');
    const provinceStaff = users.filter(u => 
      ['ADMIN', 'PROVINCE_ADMIN', 'SENIOR_ADMIN'].includes(u.role) && u.position !== 'BI_THU'
    );
    const communeStaff = users.filter(u => u.role === 'COMMUNE_ADMIN');

    res.json({
      all: users,
      deputies,
      provinceStaff,
      communeStaff
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, email, password, role, province, district, commune, agencyId } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'Email đã tồn tại' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      username, email, password: hashedPassword, role,
      locationContext: { province, district, commune },
      agencyId: agencyId || null
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
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { avatar: req.file.path }, 
      { returnDocument: 'after' }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi up ảnh', error: err.message });
  }
};

// Cập nhật chức vụ / phòng ban cho cán bộ (SENIOR_ADMIN only)
exports.updateUserPosition = async (req, res) => {
  try {
    const { position, department, positionLabel, role } = req.body;
    const POSITION_LABELS = {
      'BI_THU': 'Bí thư Tỉnh Đoàn',
      'PHO_BI_THU': 'Phó Bí thư Tỉnh Đoàn',
      'TRUONG_PHONG': 'Trưởng Phòng/Ban',
      'PHO_PHONG': 'Phó Trưởng Phòng/Ban',
      'CAN_BO': 'Cán bộ'
    };
    const DEPT_LABELS = {
      'TO_CHUC': 'Ban Tổ chức - Kiểm tra',
      'TUYEN_GIAO': 'Ban Tuyên giáo',
      'PHONG_TRAO': 'Ban Phong trào',
      'VAN_PHONG': 'Văn phòng',
      'KHAC': 'Khác'
    };

    const autoLabel = positionLabel || [
      position ? POSITION_LABELS[position] : null,
      department ? DEPT_LABELS[department] : null
    ].filter(Boolean).join(' - ');

    const updateData = {
      ...(position !== undefined && { position }),
      ...(department !== undefined && { department }),
      positionLabel: autoLabel
    };
    if (role) updateData.role = role;

    const user = await User.findByIdAndUpdate(
      req.params.id, updateData, { returnDocument: 'after', runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    res.json({ message: 'Cập nhật chức vụ thành công', user });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
