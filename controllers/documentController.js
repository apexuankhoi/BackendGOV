const Document = require('../models/Document');
const ActivityLog = require('../models/ActivityLog');

// Lấy danh sách văn bản (có filter)
exports.getDocuments = async (req, res) => {
  try {
    const { type, status, urgency, category, search, page = 1, limit = 20 } = req.query;
    const query = {};

    // Phân tách dữ liệu theo cơ quan: mỗi xã chỉ thấy VB của mình
    if (req.user.agencyId) query.agencyId = req.user.agencyId;
    
    if (type) query.type = type;
    if (status) query.status = status;
    if (urgency) query.urgency = urgency;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { documentNumber: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { issuingAgency: { $regex: search, $options: 'i' } },
        { signer: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [documents, total] = await Promise.all([
      Document.find(query)
        .populate('createdBy', 'username email')
        .populate('assignedTo', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Document.countDocuments(query)
    ]);

    res.json({ documents, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy chi tiết một văn bản
const QRCode = require('qrcode');

exports.getDocument = async (req, res) => {
  try {
    const findQuery = { _id: req.params.id };
    if (req.user.agencyId) findQuery.agencyId = req.user.agencyId;

    const doc = await Document.findOne(findQuery)
      .populate('createdBy', 'username email')
      .populate('assignedTo', 'username email');
    if (!doc) return res.status(404).json({ message: 'Không tìm thấy văn bản' });
    
    // Tạo mã QR chứa URL xác thực văn bản
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${doc._id}`;
    const qrCode = await QRCode.toDataURL(verifyUrl);
    
    res.json({ ...doc.toObject(), qrCode });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Tạo văn bản mới
exports.createDocument = async (req, res) => {
  try {
    const data = { ...req.body, createdBy: req.user.userId, agencyId: req.user.agencyId || null };
    
    // Xử lý file đính kèm
    if (req.files && req.files.length > 0) {
      data.attachments = req.files.map(f => ({
        originalName: f.originalname,
        fileName: f.filename,
        filePath: f.path,
        fileSize: f.size,
        mimeType: f.mimetype
      }));
    }

    const doc = await Document.create(data);

    // Ghi nhật ký
    await ActivityLog.create({
      user: req.user.userId,
      action: 'CREATE_DOCUMENT',
      target: `${doc.type === 'INCOMING' ? 'VB Đến' : 'VB Đi'} #${doc.documentNumber || doc._id}`,
      details: doc.summary
    });

    res.status(201).json({ message: 'Tạo văn bản thành công', document: doc });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server: ' + err.stack });
  }
};

// Cập nhật văn bản
exports.updateDocument = async (req, res) => {
  try {
    const findQuery = { _id: req.params.id };
    if (req.user.agencyId) findQuery.agencyId = req.user.agencyId;
    const doc = await Document.findOneAndUpdate(findQuery, req.body, { returnDocument: 'after' });
    if (!doc) return res.status(404).json({ message: 'Không tìm thấy văn bản' });

    await ActivityLog.create({
      user: req.user.userId,
      action: 'UPDATE_DOCUMENT',
      target: `${doc.type === 'INCOMING' ? 'VB Đến' : 'VB Đi'} #${doc.documentNumber || doc._id}`,
      details: `Cập nhật trạng thái: ${doc.status}`
    });

    res.json({ message: 'Cập nhật thành công', document: doc });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Xóa văn bản
exports.deleteDocument = async (req, res) => {
  try {
    const findQuery = { _id: req.params.id };
    if (req.user.agencyId) findQuery.agencyId = req.user.agencyId;
    const doc = await Document.findOneAndDelete(findQuery);
    if (!doc) return res.status(404).json({ message: 'Không tìm thấy văn bản' });

    await ActivityLog.create({
      user: req.user.userId,
      action: 'DELETE_DOCUMENT',
      target: `${doc.type === 'INCOMING' ? 'VB Đến' : 'VB Đi'} #${doc.documentNumber || doc._id}`
    });

    res.json({ message: 'Đã xóa văn bản' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Thống kê văn bản
exports.getStats = async (req, res) => {
  try {
    // Phân tách dữ liệu theo cơ quan
    const scope = req.user.agencyId ? { agencyId: req.user.agencyId } : {};

    const [
      totalIncoming, totalOutgoing,
      pendingCount, overdueCount, completedCount,
      urgentCount,
      recentIncoming, recentOutgoing
    ] = await Promise.all([
      Document.countDocuments({ ...scope, type: 'INCOMING' }),
      Document.countDocuments({ ...scope, type: 'OUTGOING' }),
      Document.countDocuments({ ...scope, status: 'Chờ xử lý' }),
      Document.countDocuments({ ...scope, status: 'Quá hạn' }),
      Document.countDocuments({ ...scope, status: 'Hoàn thành' }),
      Document.countDocuments({ ...scope, urgency: { $in: ['Khẩn', 'Thượng khẩn', 'Hỏa tốc'] } }),
      Document.find({ ...scope, type: 'INCOMING' }).sort({ createdAt: -1 }).limit(5).populate('createdBy', 'username'),
      Document.find({ ...scope, type: 'OUTGOING' }).sort({ createdAt: -1 }).limit(5).populate('createdBy', 'username')
    ]);

    // Thống kê theo tháng (6 tháng gần nhất)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const matchStage = { createdAt: { $gte: sixMonthsAgo } };
    if (req.user.agencyId) {
      const mongoose = require('mongoose');
      matchStage.agencyId = new mongoose.Types.ObjectId(req.user.agencyId);
    }
    
    const monthlyStats = await Document.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' }, type: '$type' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      totalIncoming, totalOutgoing,
      pendingCount, overdueCount, completedCount, urgentCount,
      recentIncoming, recentOutgoing, monthlyStats
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ================= Giai đoạn 3: LIÊN THÔNG VĂN BẢN =================
exports.dispatchDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetAgencyIds } = req.body;
    
    if (!targetAgencyIds || targetAgencyIds.length === 0) {
      return res.status(400).json({ message: 'Cần chọn ít nhất 1 cơ quan nhận' });
    }

    const doc = await Document.findOne({ _id: id, agencyId: req.user.agencyId });
    if (!doc) return res.status(404).json({ message: 'Không tìm thấy văn bản' });

    // Tạo các bản sao văn bản cho từng cơ quan nhận (Trở thành Văn bản đến của họ)
    const promises = targetAgencyIds.map(agencyId => {
      return Document.create({
        type: 'INCOMING',
        agencyId: agencyId,
        fromAgencyId: req.user.agencyId,
        isInternal: false,
        documentNumber: doc.documentNumber,
        issuedDate: doc.issuedDate || new Date(),
        receivedDate: new Date(),
        issuingAgency: doc.issuingAgency,
        signer: doc.signer,
        signerTitle: doc.signerTitle,
        summary: doc.summary,
        category: doc.category,
        field: doc.field,
        urgency: doc.urgency,
        securityLevel: doc.securityLevel,
        status: 'Chờ xử lý',
        attachments: doc.attachments,
        ocrContent: doc.ocrContent,
        createdBy: req.user.userId
      });
    });

    await Promise.all(promises);
    
    // Đánh dấu VB gốc là đã liên thông
    doc.isInternal = false;
    await doc.save();

    res.json({ message: `Đã gửi liên thông thành công tới ${targetAgencyIds.length} cơ quan` });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi gửi liên thông', error: err.message });
  }
};

// ================= Giai đoạn 4: Quan sát Tuyến dưới (Dành cho cấp Tỉnh) =================
exports.getChildAgenciesStats = async (req, res) => {
  try {
    const { agencyId } = req.user;
    if (!agencyId) return res.status(403).json({ message: 'Chưa có cơ quan' });

    const Agency = require('../models/Agency');
    const Task = require('../models/Task');
    
    // Tìm các cơ quan cấp dưới
    const childAgencies = await Agency.find({ parentAgency: agencyId }).sort({ name: 1 });
    if (!childAgencies || childAgencies.length === 0) {
      return res.json({ agencies: [] });
    }

    // Lấy thông kê cho từng cơ quan
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const agency of childAgencies) {
      const [
        totalIncoming, totalOutgoing, pendingCount, overdueCount,
        tasksTotal, tasksDone, tasksOverdue,
        incomingToday, outgoingToday
      ] = await Promise.all([
        Document.countDocuments({ agencyId: agency._id, type: 'INCOMING' }),
        Document.countDocuments({ agencyId: agency._id, type: 'OUTGOING' }),
        Document.countDocuments({ agencyId: agency._id, status: 'Chờ xử lý' }),
        Document.countDocuments({ agencyId: agency._id, status: 'Quá hạn' }),
        Task.countDocuments({ agencyId: agency._id }),
        Task.countDocuments({ agencyId: agency._id, status: 'Hoàn thành' }),
        Task.countDocuments({ agencyId: agency._id, status: 'Quá hạn' }),
        Document.countDocuments({ agencyId: agency._id, type: 'INCOMING', createdAt: { $gte: today } }),
        Document.countDocuments({ agencyId: agency._id, type: 'OUTGOING', createdAt: { $gte: today } }),
      ]);

      // Tính điểm đánh giá sơ bộ (Đơn giản hóa)
      let score = 100;
      if (overdueCount > 0) score -= (overdueCount * 2);
      if (tasksOverdue > 0) score -= (tasksOverdue * 2);
      if (score < 0) score = 0;
      
      let rating = 'Xuất sắc';
      if (score < 50) rating = 'Cần cải thiện';
      else if (score < 75) rating = 'Khá';
      else if (score < 90) rating = 'Tốt';

      result.push({
        _id: agency._id,
        name: agency.name,
        docs: {
          totalIncoming, totalOutgoing, pendingCount, overdueCount, incomingToday, outgoingToday
        },
        tasks: {
          tasksTotal, tasksDone, tasksOverdue
        },
        score,
        rating
      });
    }

    res.json({ agencies: result });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tải dữ liệu cấp dưới', error: err.message });
  }
};
