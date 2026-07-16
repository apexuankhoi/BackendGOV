const SupportRequest = require('../models/SupportRequest');
const Agency = require('../models/Agency');

const CATEGORY_LABELS = {
  'THIEN_TAI': 'Thiên tai',
  'DOI_SONG': 'Đời sống',
  'Y_TE': 'Y tế',
  'GIAO_DUC': 'Giáo dục',
  'HA_TANG': 'Hạ tầng',
  'AN_NINH': 'An ninh',
  'KHAC': 'Khác'
};

// ═══════════════════════════════════════════════════
//  PUBLIC: Gửi yêu cầu hỗ trợ (không cần đăng nhập)
// ═══════════════════════════════════════════════════
exports.submitRequest = async (req, res) => {
  try {
    const { senderName, senderPhone, senderAddress, category, content, urgency, photos, agencyId } = req.body;

    // Validate cơ bản
    if (!senderName || !senderPhone || !content || !agencyId) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ: Họ tên, Số điện thoại, Nội dung và chọn Xã/Phường.' });
    }

    // Kiểm tra agency tồn tại
    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(400).json({ message: 'Xã/Phường không hợp lệ.' });
    }

    const request = await SupportRequest.create({
      senderName,
      senderPhone,
      senderAddress: senderAddress || '',
      category: category || 'KHAC',
      content,
      urgency: urgency || 'MEDIUM',
      photos: photos || [],
      agencyId,
      submittedBy: req.user?._id || null, // Nếu đã đăng nhập thì lưu userId
    });

    // Emit socket event để thông báo realtime cho xã
    const io = req.app.get('io');
    if (io) {
      io.emit('newSupportRequest', {
        agencyId,
        agencyName: agency.name,
        trackingCode: request.trackingCode,
        category: CATEGORY_LABELS[category] || 'Khác',
        senderName,
        urgency
      });
    }

    res.status(201).json({
      message: 'Gửi yêu cầu hỗ trợ thành công! Xã/Phường sẽ sớm liên hệ với bạn.',
      trackingCode: request.trackingCode,
      request
    });
  } catch (error) {
    console.error('Error submitRequest:', error);
    res.status(500).json({ message: 'Lỗi server khi gửi yêu cầu.' });
  }
};

// ═══════════════════════════════════════════════════
//  PUBLIC: Tra cứu trạng thái bằng mã hoặc SĐT
// ═══════════════════════════════════════════════════
exports.trackRequest = async (req, res) => {
  try {
    const { code, phone } = req.query;

    if (!code && !phone) {
      return res.status(400).json({ message: 'Vui lòng nhập mã tra cứu hoặc số điện thoại.' });
    }

    let filter = {};
    if (code) filter.trackingCode = code.toUpperCase();
    else if (phone) filter.senderPhone = phone;

    const requests = await SupportRequest.find(filter)
      .populate('agencyId', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    if (requests.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu nào.' });
    }

    res.json(requests);
  } catch (error) {
    console.error('Error trackRequest:', error);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

// ═══════════════════════════════════════════════════
//  PUBLIC: Lấy danh sách Xã/Phường (COMMUNE)
// ═══════════════════════════════════════════════════
exports.getCommunes = async (req, res) => {
  try {
    const communes = await Agency.find({ level: 'COMMUNE' })
      .select('name _id')
      .sort({ name: 1 });
    res.json(communes);
  } catch (error) {
    console.error('Error getCommunes:', error);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

// ═══════════════════════════════════════════════════
//  ADMIN: Lấy danh sách yêu cầu hỗ trợ (cho xã)
// ═══════════════════════════════════════════════════
exports.getRequests = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;
    const agencyId = req.user.agencyId;
    const role = req.user.role;

    let filter = {};

    // Nếu là cấp xã thì chỉ xem yêu cầu gửi đến xã mình
    // Nếu là cấp tỉnh / super admin thì xem tất cả
    if (role === 'COMMUNE_ADMIN' && agencyId) {
      filter.agencyId = agencyId;
    }

    if (status) filter.status = status;
    if (category) filter.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
      SupportRequest.find(filter)
        .populate('agencyId', 'name')
        .populate('resolvedBy', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SupportRequest.countDocuments(filter)
    ]);

    // Thống kê nhanh
    const statsFilter = (role === 'COMMUNE_ADMIN' && agencyId) ? { agencyId } : {};
    const [totalAll, totalNew, totalInProgress, totalResolved] = await Promise.all([
      SupportRequest.countDocuments(statsFilter),
      SupportRequest.countDocuments({ ...statsFilter, status: 'NEW' }),
      SupportRequest.countDocuments({ ...statsFilter, status: { $in: ['RECEIVED', 'IN_PROGRESS'] } }),
      SupportRequest.countDocuments({ ...statsFilter, status: 'RESOLVED' }),
    ]);

    res.json({
      requests,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      stats: { totalAll, totalNew, totalInProgress, totalResolved }
    });
  } catch (error) {
    console.error('Error getRequests:', error);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

// ═══════════════════════════════════════════════════
//  ADMIN: Cập nhật trạng thái yêu cầu
// ═══════════════════════════════════════════════════
exports.updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo, assignedPhone, resolution, rejectionReason, report } = req.body;

    const request = await SupportRequest.findById(id).populate('agencyId', 'name');
    if (!request) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu.' });
    }

    const prevStatus = request.status;

    // Cập nhật các trường
    if (status) request.status = status;
    if (assignedTo) {
      request.assignedTo = assignedTo;
      request.assignedPhone = assignedPhone || '';
      request.assignedAt = new Date();
    }
    if (resolution) {
      request.resolution = resolution;
      request.resolvedAt = new Date();
      request.resolvedBy = req.user._id;
    }
    if (rejectionReason) {
      request.rejectionReason = rejectionReason;
    }
    // Lưu báo cáo chi tiết khi hoàn thành
    if (report) {
      request.report = {
        volunteersCount: report.volunteersCount || 0,
        hoursWorked: report.hoursWorked || 0,
        materialsUsed: report.materialsUsed || '',
        beneficiariesCount: report.beneficiariesCount || 0,
        satisfactionRating: report.satisfactionRating || 0,
        notes: report.notes || '',
      };
    }
    request.updatedAt = Date.now();

    await request.save();

    // Emit socket event khi trạng thái thay đổi
    const io = req.app.get('io');
    if (io && prevStatus !== status) {
      io.emit('supportRequestUpdated', {
        requestId: id,
        trackingCode: request.trackingCode,
        newStatus: status,
        agencyName: request.agencyId?.name,
        senderName: request.senderName,
      });
    }

    res.json({ message: 'Cập nhật thành công', request });
  } catch (error) {
    console.error('Error updateRequest:', error);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

// ═══════════════════════════════════════════════════
//  ADMIN: Thống kê tổng hợp toàn tỉnh
// ═══════════════════════════════════════════════════
exports.getStats = async (req, res) => {
  try {
    const [total, byStatus, byCategory, byUrgency, recentByDay, reportAgg] = await Promise.all([
      SupportRequest.countDocuments(),
      SupportRequest.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      SupportRequest.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      SupportRequest.aggregate([
        { $group: { _id: '$urgency', count: { $sum: 1 } } }
      ]),
      SupportRequest.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } },
        { $limit: 14 }
      ]),
      // Tổng hợp báo cáo từ các yêu cầu đã hoàn thành
      SupportRequest.aggregate([
        { $match: { status: 'RESOLVED' } },
        {
          $group: {
            _id: null,
            totalVolunteers: { $sum: { $ifNull: ['$report.volunteersCount', 0] } },
            totalHours: { $sum: { $ifNull: ['$report.hoursWorked', 0] } },
            totalBeneficiaries: { $sum: { $ifNull: ['$report.beneficiariesCount', 0] } },
            avgSatisfaction: { $avg: { $ifNull: ['$report.satisfactionRating', 0] } },
            reportCount: { $sum: 1 }
          }
        }
      ])
    ]);

    // Top xã có nhiều yêu cầu nhất
    const topAgencies = await SupportRequest.aggregate([
      {
        $group: {
          _id: '$agencyId',
          count: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'agencies',
          localField: '_id',
          foreignField: '_id',
          as: 'agency'
        }
      },
      { $unwind: '$agency' },
      { $project: { name: '$agency.name', count: 1, resolved: 1 } }
    ]);

    const statusMap = Object.fromEntries(byStatus.map(s => [s._id, s.count]));
    const resolvedCount = statusMap['RESOLVED'] || 0;

    res.json({
      total,
      byStatus: statusMap,
      byCategory: Object.fromEntries(byCategory.map(c => [c._id, c.count])),
      byUrgency: Object.fromEntries(byUrgency.map(u => [u._id, u.count])),
      recentByDay,
      topAgencies,
      resolutionRate: total > 0 ? Math.round((resolvedCount / total) * 100) : 0,
      reportSummary: reportAgg[0] || { totalVolunteers: 0, totalHours: 0, totalBeneficiaries: 0, avgSatisfaction: 0, reportCount: 0 }
    });
  } catch (error) {
    console.error('Error getStats:', error);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

