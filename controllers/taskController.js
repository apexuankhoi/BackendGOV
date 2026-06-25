const Task = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');

// Lấy danh sách công việc
exports.getTasks = async (req, res) => {
  try {
    const { status, priority, assignedTo, search } = req.query;
    const query = {};
    if (req.user.agencyId) query.agencyId = req.user.agencyId;
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query)
      .populate('assignedBy', 'username email')
      .populate('assignedTo', 'username email')
      .populate('sourceDocument', 'documentNumber summary')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy công việc quá hạn
exports.getOverdueTasks = async (req, res) => {
  try {
    const scope = req.user.agencyId ? { agencyId: req.user.agencyId } : {};

    // Cập nhật tất cả task quá hạn (scope chung hoặc theo agencyId)
    await Task.updateMany(
      { ...scope, deadline: { $lt: new Date() }, status: { $nin: ['Hoàn thành', 'Hủy', 'Quá hạn'] } },
      { $set: { status: 'Quá hạn' } }
    );

    const tasks = await Task.find({ ...scope, status: 'Quá hạn' })
      .populate('assignedBy', 'username')
      .populate('assignedTo', 'username')
      .sort({ deadline: 1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Thống kê công việc
exports.getTaskStats = async (req, res) => {
  try {
    const scope = req.user.agencyId ? { agencyId: req.user.agencyId } : {};

    // Cập nhật quá hạn trước
    await Task.updateMany(
      { ...scope, deadline: { $lt: new Date() }, status: { $nin: ['Hoàn thành', 'Hủy', 'Quá hạn'] } },
      { $set: { status: 'Quá hạn' } }
    );

    const [total, pending, inProgress, completed, overdue, cancelled] = await Promise.all([
      Task.countDocuments(scope),
      Task.countDocuments({ ...scope, status: 'Chưa thực hiện' }),
      Task.countDocuments({ ...scope, status: 'Đang thực hiện' }),
      Task.countDocuments({ ...scope, status: 'Hoàn thành' }),
      Task.countDocuments({ ...scope, status: 'Quá hạn' }),
      Task.countDocuments({ ...scope, status: 'Hủy' })
    ]);

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({ total, pending, inProgress, completed, overdue, cancelled, completionRate });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Tạo công việc
exports.createTask = async (req, res) => {
  try {
    const data = { ...req.body, assignedBy: req.user.userId, agencyId: req.user.agencyId || null };
    const task = await Task.create(data);

    await ActivityLog.create({
      user: req.user.userId,
      action: 'CREATE_TASK',
      target: task.title,
      details: `Deadline: ${task.deadline ? new Date(task.deadline).toLocaleDateString('vi-VN') : 'Không có'}`
    });

    res.status(201).json({ message: 'Tạo công việc thành công', task });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Cập nhật công việc
exports.updateTask = async (req, res) => {
  try {
    const findQuery = { _id: req.params.id };
    if (req.user.agencyId) findQuery.agencyId = req.user.agencyId;
    
    const task = await Task.findOneAndUpdate(findQuery, req.body, { returnDocument: 'after' });
    if (!task) return res.status(404).json({ message: 'Không tìm thấy công việc' });

    await ActivityLog.create({
      user: req.user.userId,
      action: 'UPDATE_TASK',
      target: task.title,
      details: `Trạng thái: ${task.status} — Tiến độ: ${task.progress}%`
    });

    res.json({ message: 'Cập nhật thành công', task });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Xóa công việc
exports.deleteTask = async (req, res) => {
  try {
    const findQuery = { _id: req.params.id };
    if (req.user.agencyId) findQuery.agencyId = req.user.agencyId;
    
    const task = await Task.findOneAndDelete(findQuery);
    if (!task) return res.status(404).json({ message: 'Không tìm thấy công việc' });

    await ActivityLog.create({
      user: req.user.userId,
      action: 'DELETE_TASK',
      target: task.title
    });

    res.json({ message: 'Đã xóa công việc' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
