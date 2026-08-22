const Task = require('../models/Task');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// Helper: populate đầy đủ thông tin user trong task
const POPULATE_USER = 'username email role position department positionLabel';

// ========== LẤY DANH SÁCH CÔNG VIỆC ==========
exports.getTasks = async (req, res) => {
  try {
    const { status, priority, assignedTo, search, view } = req.query;
    const userId = req.user.userId;
    const role = req.user.role;

    let query = {};

    // SENIOR_ADMIN (Bí thư) & PROVINCE_ADMIN (PBT): xem tất cả
    if (['SENIOR_ADMIN', 'PROVINCE_ADMIN'].includes(role)) {
      if (req.user.agencyId) query.agencyId = req.user.agencyId;
    } else if (role === 'ADMIN') {
      // Trưởng phòng/ban: thấy task được giao cho mình hoặc mình giao đi
      query.$or = [
        { assignedTo: userId },
        { assignedBy: userId },
        { delegatedTo: userId }
      ];
    } else {
      // Cán bộ xã: chỉ thấy task của mình
      query.$or = [
        { assignedTo: userId },
        { delegatedTo: userId }
      ];
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // Cập nhật deadline color trước khi lấy
    await Task.updateMany(
      { deadline: { $lt: new Date() }, status: { $nin: ['Hoàn thành', 'Hủy', 'Quá hạn'] } },
      { $set: { status: 'Quá hạn', deadlineColor: 'red' } }
    );

    const tasks = await Task.find(query)
      .populate('assignedBy', POPULATE_USER)
      .populate('assignedTo', POPULATE_USER)
      .populate('delegatedTo', POPULATE_USER)
      .populate('watchers', POPULATE_USER)
      .populate('parentTask', 'title status')
      .populate('comments.author', 'username avatar')
      .populate('sourceDocument', 'documentNumber summary')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ========== THỐNG KÊ DASHBOARD (Dùng cho màn hình Bí thư) ==========
exports.getTaskDashboard = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.userId;

    // Scope theo cấp quyền
    let scope = {};
    if (req.user.agencyId) scope.agencyId = req.user.agencyId;

    // Cập nhật trạng thái quá hạn
    await Task.updateMany(
      { ...scope, deadline: { $lt: new Date() }, status: { $nin: ['Hoàn thành', 'Hủy', 'Quá hạn'] } },
      { $set: { status: 'Quá hạn', deadlineColor: 'red' } }
    );

    const [total, pending, inProgress, waitApproval, completed, overdue, cancelled] = await Promise.all([
      Task.countDocuments(scope),
      Task.countDocuments({ ...scope, status: 'Chưa thực hiện' }),
      Task.countDocuments({ ...scope, status: 'Đang thực hiện' }),
      Task.countDocuments({ ...scope, status: 'Chờ duyệt' }),
      Task.countDocuments({ ...scope, status: 'Hoàn thành' }),
      Task.countDocuments({ ...scope, status: 'Quá hạn' }),
      Task.countDocuments({ ...scope, status: 'Hủy' })
    ]);

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Top 5 task quá hạn gần nhất
    const overdueList = await Task.find({ ...scope, status: 'Quá hạn' })
      .populate('assignedTo', 'username positionLabel')
      .populate('assignedBy', 'username positionLabel')
      .sort({ deadline: 1 })
      .limit(5);

    // Top 5 task sắp đến hạn (trong 5 ngày tới)
    const soon = new Date();
    soon.setDate(soon.getDate() + 5);
    const upcomingList = await Task.find({
      ...scope,
      deadline: { $gte: new Date(), $lte: soon },
      status: { $nin: ['Hoàn thành', 'Hủy', 'Quá hạn'] }
    })
      .populate('assignedTo', 'username positionLabel')
      .sort({ deadline: 1 })
      .limit(5);

    // Thống kê theo người nhận (ai đang trễ nhiều nhất)
    const byAssignee = await Task.aggregate([
      { $match: { ...scope } },
      { $group: {
        _id: '$assignedTo',
        total: { $sum: 1 },
        overdue: { $sum: { $cond: [{ $eq: ['$status', 'Quá hạn'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'Hoàn thành'] }, 1, 0] } },
        avgProgress: { $avg: '$progress' }
      }},
      { $sort: { overdue: -1 } },
      { $limit: 10 }
    ]);

    // Lấy tên user cho byAssignee
    const assigneeIds = byAssignee.map(a => a._id).filter(Boolean);
    const assigneeUsers = await User.find({ _id: { $in: assigneeIds } }).select('username positionLabel department');
    const assigneeMap = {};
    assigneeUsers.forEach(u => { assigneeMap[u._id.toString()] = u; });

    const byAssigneeWithName = byAssignee.map(a => ({
      ...a,
      user: a._id ? assigneeMap[a._id.toString()] : null
    }));

    res.json({
      total, pending, inProgress, waitApproval, completed, overdue, cancelled,
      completionRate,
      overdueList,
      upcomingList,
      byAssignee: byAssigneeWithName
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ========== LẤY TASK QUÁ HẠN ==========
exports.getOverdueTasks = async (req, res) => {
  try {
    const scope = req.user.agencyId ? { agencyId: req.user.agencyId } : {};
    await Task.updateMany(
      { ...scope, deadline: { $lt: new Date() }, status: { $nin: ['Hoàn thành', 'Hủy', 'Quá hạn'] } },
      { $set: { status: 'Quá hạn', deadlineColor: 'red' } }
    );
    const tasks = await Task.find({ ...scope, status: 'Quá hạn' })
      .populate('assignedBy', POPULATE_USER)
      .populate('assignedTo', POPULATE_USER)
      .sort({ deadline: 1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ========== THỐNG KÊ CŨ (backward compat) ==========
exports.getTaskStats = async (req, res) => {
  try {
    const scope = req.user.agencyId ? { agencyId: req.user.agencyId } : {};
    await Task.updateMany(
      { ...scope, deadline: { $lt: new Date() }, status: { $nin: ['Hoàn thành', 'Hủy', 'Quá hạn'] } },
      { $set: { status: 'Quá hạn', deadlineColor: 'red' } }
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

// ========== TẠO CÔNG VIỆC ==========
exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, deadline, priority, notes, parentTask, delegationLevel, sourceDocument } = req.body;
    if (!title) return res.status(400).json({ message: 'Thiếu tiêu đề công việc' });

    // Tính deadlineColor ngay lúc tạo
    let deadlineColor = 'gray';
    if (deadline) {
      const dl = new Date(deadline);
      const now = new Date();
      const daysLeft = Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 0) deadlineColor = 'red';
      else if (daysLeft <= 5) deadlineColor = 'yellow';
      else deadlineColor = 'green';
    }

    const task = await Task.create({
      title, description, assignedTo: assignedTo || undefined,
      deadline: deadline || undefined,
      priority: priority || 'Trung bình',
      notes: notes || '',
      parentTask: parentTask || null,
      delegationLevel: delegationLevel || 0,
      sourceDocument: sourceDocument || null,
      deadlineColor,
      assignedBy: req.user.userId,
      agencyId: req.user.agencyId || null
    });

    // Nếu có task cha, ghi nhận sub-task
    if (parentTask) {
      await Task.findByIdAndUpdate(parentTask, { $push: { delegatedTo: assignedTo } });
    }

    // Realtime notification
    const io = req.app.get('io');
    if (io && assignedTo) {
      io.emit('taskAssigned', { taskId: task._id, assignedTo, title });
    }

    await ActivityLog.create({
      user: req.user.userId,
      action: 'CREATE_TASK',
      target: task.title,
      details: `Giao cho: ${assignedTo || 'Chưa gán'} — Deadline: ${deadline ? new Date(deadline).toLocaleDateString('vi-VN') : 'Không có'}`
    });

    const populated = await Task.findById(task._id)
      .populate('assignedBy', POPULATE_USER)
      .populate('assignedTo', POPULATE_USER);

    res.status(201).json({ message: 'Tạo công việc thành công', task: populated });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ========== UỶ QUYỀN / GIAO LẠI TASK ==========
exports.delegateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { delegateTo, note } = req.body;
    if (!delegateTo) return res.status(400).json({ message: 'Thiếu người được ủy quyền' });

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: 'Không tìm thấy công việc' });

    // Tạo sub-task
    const deadlineColor = task.deadlineColor;
    const subTask = await Task.create({
      title: `[ĐA] ${task.title}`,
      description: task.description,
      assignedBy: req.user.userId,
      assignedTo: delegateTo,
      deadline: task.deadline,
      priority: task.priority,
      parentTask: task._id,
      delegationLevel: (task.delegationLevel || 0) + 1,
      agencyId: task.agencyId,
      deadlineColor,
      notes: note || ''
    });

    // Ghi thêm vào danh sách delegate của task cha
    task.delegatedTo.push(delegateTo);
    if (note) {
      task.comments.push({
        author: req.user.userId,
        content: `📤 Đã ủy quyền thực hiện cho người khác. Ghi chú: ${note}`
      });
    }
    await task.save();

    // Realtime notification
    const io = req.app.get('io');
    if (io) io.emit('taskAssigned', { taskId: subTask._id, assignedTo: delegateTo, title: subTask.title });

    await ActivityLog.create({
      user: req.user.userId, action: 'DELEGATE_TASK', target: task.title,
      details: `Ủy quyền cho user: ${delegateTo}`
    });

    res.json({ message: 'Ủy quyền thành công', subTask });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ========== CẬP NHẬT CÔNG VIỆC ==========
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Không tìm thấy công việc' });

    // Chỉ người giao hoặc admin mới được sửa
    const isOwner = task.assignedBy.toString() === req.user.userId;
    const isAdmin = ['SENIOR_ADMIN', 'PROVINCE_ADMIN', 'ADMIN'].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa công việc này' });
    }

    Object.assign(task, req.body);
    await task.save(); // pre-save tự tính deadlineColor

    await ActivityLog.create({
      user: req.user.userId, action: 'UPDATE_TASK', target: task.title,
      details: `Trạng thái: ${task.status} — Tiến độ: ${task.progress}%`
    });

    const populated = await Task.findById(task._id)
      .populate('assignedBy', POPULATE_USER)
      .populate('assignedTo', POPULATE_USER)
      .populate('delegatedTo', POPULATE_USER);

    res.json({ message: 'Cập nhật thành công', task: populated });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ========== THÊM BÌNH LUẬN / CẬP NHẬT TIẾN ĐỘ ==========
exports.addComment = async (req, res) => {
  try {
    const { content, progressUpdate } = req.body;
    if (!content) return res.status(400).json({ message: 'Thiếu nội dung bình luận' });

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Không tìm thấy công việc' });

    task.comments.push({
      author: req.user.userId,
      content,
      progressUpdate: progressUpdate !== undefined ? Number(progressUpdate) : null
    });

    if (progressUpdate !== undefined) {
      task.progress = Math.min(100, Math.max(0, Number(progressUpdate)));
      if (task.progress === 100) task.status = 'Chờ duyệt';
      else if (task.progress > 0) task.status = 'Đang thực hiện';
    }

    await task.save();

    const populated = await Task.findById(task._id)
      .populate('comments.author', 'username avatar positionLabel');

    res.json({ message: 'Đã thêm bình luận', comments: populated.comments });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ========== DUYỆT HOÀN THÀNH (Chỉ người giao mới duyệt) ==========
exports.approveTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Không tìm thấy công việc' });

    const isOwner = task.assignedBy.toString() === req.user.userId;
    const isSenior = ['SENIOR_ADMIN', 'PROVINCE_ADMIN'].includes(req.user.role);
    if (!isOwner && !isSenior) {
      return res.status(403).json({ message: 'Chỉ người giao việc mới có thể duyệt hoàn thành' });
    }

    task.status = 'Hoàn thành';
    task.progress = 100;
    task.deadlineColor = 'green';
    task.comments.push({
      author: req.user.userId,
      content: '✅ Đã duyệt hoàn thành công việc.',
      progressUpdate: 100
    });
    await task.save();

    await ActivityLog.create({
      user: req.user.userId, action: 'APPROVE_TASK', target: task.title
    });

    res.json({ message: 'Đã duyệt hoàn thành', task });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ========== XÓA CÔNG VIỆC ==========
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Không tìm thấy công việc' });
    await task.deleteOne();
    // Xóa luôn sub-tasks
    await Task.deleteMany({ parentTask: req.params.id });
    await ActivityLog.create({ user: req.user.userId, action: 'DELETE_TASK', target: task.title });
    res.json({ message: 'Đã xóa công việc' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};


