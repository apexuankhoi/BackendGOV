const Document = require('../models/Document');
const ActivityLog = require('../models/ActivityLog');

// Lấy danh sách văn bản (có filter)
exports.getDocuments = async (req, res) => {
  try {
    const { type, status, urgency, category, search, page = 1, limit = 20 } = req.query;
    const query = {};
    
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
    const doc = await Document.findById(req.params.id)
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
    const data = { ...req.body, createdBy: req.user.userId };
    
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
    const doc = await Document.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
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
    const doc = await Document.findByIdAndDelete(req.params.id);
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
    const [
      totalIncoming, totalOutgoing,
      pendingCount, overdueCount, completedCount,
      urgentCount,
      recentIncoming, recentOutgoing
    ] = await Promise.all([
      Document.countDocuments({ type: 'INCOMING' }),
      Document.countDocuments({ type: 'OUTGOING' }),
      Document.countDocuments({ status: 'Chờ xử lý' }),
      Document.countDocuments({ status: 'Quá hạn' }),
      Document.countDocuments({ status: 'Hoàn thành' }),
      Document.countDocuments({ urgency: { $in: ['Khẩn', 'Thượng khẩn', 'Hỏa tốc'] } }),
      Document.find({ type: 'INCOMING' }).sort({ createdAt: -1 }).limit(5).populate('createdBy', 'username'),
      Document.find({ type: 'OUTGOING' }).sort({ createdAt: -1 }).limit(5).populate('createdBy', 'username')
    ]);

    // Thống kê theo tháng (6 tháng gần nhất)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyStats = await Document.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
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
