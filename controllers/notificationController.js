const Document = require('../models/Document');
const Task = require('../models/Task');

exports.getNotificationSummary = async (req, res) => {
  try {
    const role = req.user.role;
    
    // Nếu là Admin, xem xét tất cả. Nếu là user thường, chỉ xem task của mình
    let taskQuery = { status: 'Quá hạn' };
    if (req.user.agencyId) taskQuery.agencyId = req.user.agencyId;
    if (role !== 'SENIOR_ADMIN' && role !== 'ADMIN' && role !== 'PROVINCE_ADMIN') {
      taskQuery.assignedTo = req.user.userId;
    }

    const overdueTasks = await Task.find(taskQuery)
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .limit(5);

    // Văn bản Khẩn / Hỏa tốc
    const docQuery = { type: 'INCOMING', urgency: { $in: ['Khẩn', 'Thượng khẩn', 'Hỏa tốc'] } };
    if (req.user.agencyId) docQuery.agencyId = req.user.agencyId;

    const urgentDocs = await Document.find(docQuery)
      .sort({ createdAt: -1 })
      .limit(5);

    const notifications = [];

    overdueTasks.forEach(t => {
      notifications.push({
        id: t._id,
        type: 'task',
        title: 'Công việc quá hạn',
        message: `Nhiệm vụ "${t.title}" đã quá hạn xử lý.`,
        date: t.deadline || t.createdAt,
        isRead: false
      });
    });

    urgentDocs.forEach(d => {
      notifications.push({
        id: d._id,
        type: 'document',
        title: `Văn bản ${d.urgency}`,
        message: `Có văn bản đến: "${d.title}" cần xử lý ngay.`,
        date: d.createdAt,
        isRead: false
      });
    });

    // Sắp xếp theo ngày mới nhất
    notifications.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      unreadCount: notifications.length,
      items: notifications
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy thông báo', error: err.message });
  }
};
