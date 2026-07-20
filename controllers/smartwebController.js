const SmartwebRegistration = require('../models/SmartwebRegistration');
const Agency = require('../models/Agency');
const QRCode = require('qrcode');

// ═══════════════════════════════════════════════════════
// PUBLIC: Tiểu thương tự đăng ký (không cần đăng nhập)
// ═══════════════════════════════════════════════════════
exports.publicRegister = async (req, res) => {
  try {
    const { ownerName, phone, address, businessName, businessType, agencyId } = req.body;

    if (!ownerName || !phone || !businessName || !agencyId) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin bắt buộc.' });
    }

    // Kiểm tra SĐT đã đăng ký chưa
    const existing = await SmartwebRegistration.findOne({ phone, status: { $ne: 'CANCELLED' } });
    if (existing) {
      return res.status(409).json({ 
        message: 'Số điện thoại này đã được đăng ký trước đó.',
        trackingCode: existing.trackingCode
      });
    }

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(404).json({ message: 'Không tìm thấy đơn vị xã/phường.' });
    }

    const reg = await SmartwebRegistration.create({
      ownerName, phone, address,
      businessName, businessType: businessType || 'KHAC',
      agencyId
    });

    res.status(201).json({
      message: 'Đăng ký thành công! Đoàn viên sẽ liên hệ hỗ trợ bạn trong thời gian sớm nhất.',
      trackingCode: reg.trackingCode
    });
  } catch (err) {
    console.error('publicRegister error:', err);
    res.status(500).json({ message: 'Lỗi server khi đăng ký.' });
  }
};

// ═══════════════════════════════════════════════════════
// PUBLIC: Tra cứu trạng thái theo mã
// ═══════════════════════════════════════════════════════
exports.trackStatus = async (req, res) => {
  try {
    const { code } = req.params;
    const reg = await SmartwebRegistration.findOne({ trackingCode: code.toUpperCase() })
      .populate('agencyId', 'name');

    if (!reg) {
      return res.status(404).json({ message: 'Không tìm thấy mã đăng ký này.' });
    }

    res.json({
      trackingCode: reg.trackingCode,
      ownerName: reg.ownerName,
      businessName: reg.businessName,
      status: reg.status,
      domain: reg.domain || null,
      websiteUrl: reg.websiteUrl || null,
      agencyName: reg.agencyId?.name || 'Không rõ',
      createdAt: reg.createdAt,
      registeredAt: reg.registeredAt || null
    });
  } catch (err) {
    console.error('trackStatus error:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

// ═══════════════════════════════════════════════════════
// ADMIN: Lấy danh sách đăng ký (Tỉnh / Xã xem)
// ═══════════════════════════════════════════════════════
exports.getAll = async (req, res) => {
  try {
    const { status, agencyId, page = 1, limit = 20 } = req.query;
    const filter = {};

    // Nếu là COMMUNE_ADMIN chỉ xem của xã mình
    if (req.user.role === 'COMMUNE_ADMIN') {
      filter.agencyId = req.user.agencyId;
    } else if (agencyId) {
      filter.agencyId = agencyId;
    }

    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [docs, total] = await Promise.all([
      SmartwebRegistration.find(filter)
        .populate('agencyId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SmartwebRegistration.countDocuments(filter)
    ]);

    res.json({ docs, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('getAll error:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

// ═══════════════════════════════════════════════════════
// ADMIN: Cập nhật trạng thái đăng ký
// ═══════════════════════════════════════════════════════
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, domain, websiteUrl, supportedBy, supportedPhone, notes } = req.body;

    const reg = await SmartwebRegistration.findById(id);
    if (!reg) return res.status(404).json({ message: 'Không tìm thấy đăng ký.' });

    if (status) reg.status = status;
    if (domain) reg.domain = domain;
    if (websiteUrl) reg.websiteUrl = websiteUrl;
    if (supportedBy) reg.supportedBy = supportedBy;
    if (supportedPhone) reg.supportedPhone = supportedPhone;
    if (notes !== undefined) reg.notes = notes;

    if (status === 'REGISTERED' && !reg.registeredAt) {
      reg.registeredAt = new Date();
    }

    await reg.save();
    res.json({ message: 'Cập nhật thành công.', registration: reg });
  } catch (err) {
    console.error('updateStatus error:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

// ═══════════════════════════════════════════════════════
// ADMIN: Thống kê tổng hợp SmartWeb
// ═══════════════════════════════════════════════════════
exports.getStats = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'COMMUNE_ADMIN') {
      filter.agencyId = req.user.agencyId;
    }

    const [total, byStatus, byAgency] = await Promise.all([
      SmartwebRegistration.countDocuments(filter),
      SmartwebRegistration.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      SmartwebRegistration.aggregate([
        { $match: filter },
        { $group: { _id: '$agencyId', count: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } } } },
        { $lookup: { from: 'agencies', localField: '_id', foreignField: '_id', as: 'agency' } },
        { $unwind: { path: '$agency', preserveNullAndEmptyArrays: true } },
        { $project: { agencyName: '$agency.name', count: 1, active: 1 } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ])
    ]);

    const statusMap = {};
    byStatus.forEach(s => { statusMap[s._id] = s.count; });

    res.json({
      total,
      pending: statusMap['PENDING'] || 0,
      contacted: statusMap['CONTACTED'] || 0,
      registered: statusMap['REGISTERED'] || 0,
      active: statusMap['ACTIVE'] || 0,
      cancelled: statusMap['CANCELLED'] || 0,
      byAgency
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

// ═══════════════════════════════════════════════════════
// PUBLIC: Lấy thống kê công khai (counter cho trang chủ)
// ═══════════════════════════════════════════════════════
exports.getPublicStats = async (req, res) => {
  try {
    const [total, active, registered] = await Promise.all([
      SmartwebRegistration.countDocuments(),
      SmartwebRegistration.countDocuments({ status: 'ACTIVE' }),
      SmartwebRegistration.countDocuments({ status: { $in: ['REGISTERED', 'ACTIVE'] } })
    ]);
    res.json({ total, active, registered });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

// ═══════════════════════════════════════════════════════
// ADMIN: Tạo QR code cho điểm đăng ký tại xã
// ═══════════════════════════════════════════════════════
exports.generateQR = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const agency = await Agency.findById(agencyId);
    if (!agency) return res.status(404).json({ message: 'Không tìm thấy đơn vị.' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const registrationUrl = `${frontendUrl}/dang-ky-website?agency=${agencyId}`;

    const qrDataUrl = await QRCode.toDataURL(registrationUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#1a3a6b', light: '#ffffff' },
      errorCorrectionLevel: 'H'
    });

    res.json({
      agencyId,
      agencyName: agency.name,
      registrationUrl,
      qrDataUrl
    });
  } catch (err) {
    console.error('generateQR error:', err);
    res.status(500).json({ message: 'Lỗi tạo QR code.' });
  }
};

// ═══════════════════════════════════════════════════════
// ADMIN: Xuất Excel danh sách đăng ký
// ═══════════════════════════════════════════════════════
exports.exportExcel = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const filter = {};
    if (req.user.role === 'COMMUNE_ADMIN') filter.agencyId = req.user.agencyId;
    if (req.query.agencyId) filter.agencyId = req.query.agencyId;
    if (req.query.status) filter.status = req.query.status;

    const STATUS_LABEL = {
      PENDING: 'Chờ hỗ trợ', CONTACTED: 'Đã liên hệ',
      REGISTERED: 'Đã đăng ký tên miền', ACTIVE: 'Website hoạt động', CANCELLED: 'Hủy'
    };
    const TYPE_LABEL = {
      BAN_LE: 'Bán lẻ', NONG_SAN: 'Nông sản', AN_UONG: 'Ăn uống',
      THOI_TRANG: 'Thời trang', DICH_VU: 'Dịch vụ', THU_CONG: 'Thủ công mỹ nghệ', KHAC: 'Khác'
    };

    const docs = await SmartwebRegistration.find(filter)
      .populate('agencyId', 'name')
      .sort({ createdAt: -1 });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Danh sách đăng ký SmartWeb');

    ws.columns = [
      { header: 'Mã tra cứu', key: 'trackingCode', width: 20 },
      { header: 'Họ tên', key: 'ownerName', width: 22 },
      { header: 'SĐT', key: 'phone', width: 15 },
      { header: 'Tên cơ sở', key: 'businessName', width: 25 },
      { header: 'Loại hình', key: 'businessType', width: 18 },
      { header: 'Đơn vị xã', key: 'agencyName', width: 22 },
      { header: 'Trạng thái', key: 'status', width: 20 },
      { header: 'Tên miền', key: 'domain', width: 25 },
      { header: 'Người hỗ trợ', key: 'supportedBy', width: 20 },
      { header: 'Ngày đăng ký', key: 'createdAt', width: 18 },
    ];

    // Style header
    ws.getRow(1).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a3a6b' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    ws.getRow(1).height = 30;

    docs.forEach((d, idx) => {
      const row = ws.addRow({
        trackingCode: d.trackingCode,
        ownerName: d.ownerName,
        phone: d.phone,
        businessName: d.businessName,
        businessType: TYPE_LABEL[d.businessType] || d.businessType,
        agencyName: d.agencyId?.name || 'Không rõ',
        status: STATUS_LABEL[d.status] || d.status,
        domain: d.domain || '',
        supportedBy: d.supportedBy || '',
        createdAt: new Date(d.createdAt).toLocaleDateString('vi-VN'),
      });
      if (idx % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
        });
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=smartweb_${Date.now()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('exportExcel error:', err);
    res.status(500).json({ message: 'Lỗi xuất Excel.' });
  }
};
