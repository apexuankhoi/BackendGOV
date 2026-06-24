const Team = require('../models/Team');

exports.createTeam = async (req, res) => {
  try {
    const teamData = { ...req.body, createdBy: req.user.userId };
    
    // Nếu là cấp Xã tạo, trạng thái mặc định là PENDING. Nếu là Tỉnh tự tạo có thể là APPROVED
    teamData.status = req.user.role === 'PROVINCE_ADMIN' ? 'APPROVED' : 'PENDING';

    const team = new Team(teamData);
    await team.save();
    res.status(201).json({ message: 'Khai báo đội hình thành công', team });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.getTeams = async (req, res) => {
  try {
    const { status, province } = req.query;
    let query = {};
    if (status) query.status = status;
    if (province) query['location.province'] = province;
    
    // Nếu xem ở Public Map, chỉ lấy APPROVED
    if (!req.user) {
        query.status = 'APPROVED';
    }

    const teams = await Team.find(query).populate('createdBy', 'username email');
    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.approveTeam = async (req, res) => {
  try {
    // Middleware ở route sẽ chặn đảm bảo chỉ PROVINCE_ADMIN hoặc SENIOR_ADMIN vào đây
    const { id } = req.params;
    const { status } = req.body; // 'APPROVED' or 'REJECTED'

    const team = await Team.findByIdAndUpdate(id, { status }, { returnDocument: 'after' });
    if (!team) return res.status(404).json({ message: 'Không tìm thấy đội hình' });

    res.json({ message: `Đã ${status === 'APPROVED' ? 'duyệt' : 'từ chối'} đội hình`, team });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
