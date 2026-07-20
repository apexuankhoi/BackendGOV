const CampaignReport = require('../models/CampaignReport');
const ExcelJS = require('exceljs');
const Agency = require('../models/Agency');

// Gửi báo cáo hằng ngày (hoặc cập nhật nếu đã có trong ngày)
exports.submitReport = async (req, res) => {
  try {
    const { 
      reportDate, activeTeams, volunteers, digitalSkills, vneidSupport, 
      publicServices, qrSupport, trainingClasses, digitalProducts, 
      youthTrained, safetyCampaigns, mediaPosts,
      smartwebCount, websitesCreated,
      issues, proposals, evidenceLinks 
    } = req.body;

    const agencyId = req.user.agencyId;
    if (!agencyId) {
      return res.status(403).json({ message: 'Tài khoản không thuộc cơ quan/đơn vị nào.' });
    }

    // 1. Kiểm tra khung giờ (18:00 - 20:00)
    const currentHour = new Date().getHours();
    if (currentHour < 18 || currentHour >= 20) {
      return res.status(403).json({ message: 'Hệ thống chỉ mở cổng nhận báo cáo chiến dịch từ 18:00 đến 20:00 hằng ngày.' });
    }

    // 2. Chuẩn hóa ngày hiện tại về 00:00:00
    const dateObj = new Date();
    dateObj.setHours(0, 0, 0, 0);

    // 3. Kiểm tra xem đã nộp báo cáo hôm nay chưa
    const existingReport = await CampaignReport.findOne({ agencyId, reportDate: dateObj });
    if (existingReport) {
      return res.status(403).json({ message: 'Bạn đã nộp báo cáo chiến dịch cho ngày hôm nay rồi. Vui lòng quay lại vào 18h00 ngày mai!' });
    }

    const updateData = {
      agencyId,
      reporterId: req.user._id,
      reportDate: dateObj,
      activeTeams: activeTeams || 0,
      volunteers: volunteers || 0,
      digitalSkills: digitalSkills || 0,
      vneidSupport: vneidSupport || 0,
      publicServices: publicServices || 0,
      qrSupport: qrSupport || 0,
      trainingClasses: trainingClasses || 0,
      digitalProducts: digitalProducts || 0,
      youthTrained: youthTrained || 0,
      safetyCampaigns: safetyCampaigns || 0,
      mediaPosts: mediaPosts || 0,
      smartwebCount: smartwebCount || 0,
      websitesCreated: websitesCreated || 0,
      issues: issues || '',
      proposals: proposals || '',
      evidenceLinks: evidenceLinks || '',
      updatedAt: Date.now()
    };

    const report = await CampaignReport.create(updateData);

    res.json({ message: 'Lưu báo cáo thành công', report });
  } catch (error) {
    console.error('Error submitReport:', error);
    res.status(500).json({ message: 'Lỗi server khi lưu báo cáo' });
  }
};

// Lấy báo cáo của đơn vị trong ngày (để hiển thị lại lên form nếu họ đã nộp)
exports.getMyReport = async (req, res) => {
  try {
    const agencyId = req.user.agencyId;
    if (!agencyId) return res.json(null);

    const { date } = req.query;
    const dateObj = new Date(date || Date.now());
    dateObj.setHours(0, 0, 0, 0);

    const report = await CampaignReport.findOne({ agencyId, reportDate: dateObj });
    res.json(report);
  } catch (error) {
    console.error('Error getMyReport:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Thống kê lũy kế toàn tỉnh
exports.getGlobalStats = async (req, res) => {
  try {
    const stats = await CampaignReport.aggregate([
      {
        $group: {
          _id: null,
          totalVneid: { $sum: '$vneidSupport' },
          totalQr: { $sum: '$qrSupport' },
          totalDigitalSkills: { $sum: '$digitalSkills' },
          totalPublicServices: { $sum: '$publicServices' },
          totalSmartWeb: { $sum: '$smartwebCount' },
          totalWebsitesCreated: { $sum: '$websitesCreated' },
          totalVolunteers: { $sum: '$volunteers' },
          totalTrainingClasses: { $sum: '$trainingClasses' },
          totalYouthTrained: { $sum: '$youthTrained' },
          totalDigitalProducts: { $sum: '$digitalProducts' }
        }
      }
    ]);

    const activeAgenciesCount = await CampaignReport.distinct('agencyId').then(arr => arr.length);
    const totalAgencies = await Agency.countDocuments({ level: 'COMMUNE' });

    res.json({
      vneid: stats[0]?.totalVneid || 0,
      qr: stats[0]?.totalQr || 0,
      digitalSkills: stats[0]?.totalDigitalSkills || 0,
      publicServices: stats[0]?.totalPublicServices || 0,
      smartwebCount: stats[0]?.totalSmartWeb || 0,
      websitesCreated: stats[0]?.totalWebsitesCreated || 0,
      volunteers: stats[0]?.totalVolunteers || 0,
      trainingClasses: stats[0]?.totalTrainingClasses || 0,
      youthTrained: stats[0]?.totalYouthTrained || 0,
      digitalProducts: stats[0]?.totalDigitalProducts || 0,
      activeAgencies: activeAgenciesCount,
      totalAgencies: totalAgencies > 0 ? totalAgencies : 102
    });
  } catch (error) {
    console.error('Error getGlobalStats:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Dành cho cấp Tỉnh xem báo cáo của tất cả các xã
exports.getAllReports = async (req, res) => {
  try {
    const { date } = req.query;
    const dateObj = new Date(date || Date.now());
    dateObj.setHours(0, 0, 0, 0);

    const reports = await CampaignReport.find({ reportDate: dateObj })
      .populate('agencyId', 'name')
      .populate('reporterId', 'username')
      .sort({ updatedAt: -1 });

    res.json(reports);
  } catch (error) {
    console.error('Error getAllReports:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Xuất Excel báo cáo chiến dịch (Tỉnh)
exports.exportExcel = async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    let filter = {};

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      filter.reportDate = d;
    } else if (startDate && endDate) {
      filter.reportDate = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

    const reports = await CampaignReport.find(filter)
      .populate('agencyId', 'name')
      .populate('reporterId', 'username')
      .sort({ reportDate: -1, updatedAt: -1 });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Báo cáo Chiến dịch 44 ngày');

    ws.columns = [
      { header: 'Đơn vị', key: 'agency', width: 25 },
      { header: 'Người nộp', key: 'reporter', width: 18 },
      { header: 'Ngày báo cáo', key: 'reportDate', width: 15 },
      { header: 'Số đội hình', key: 'activeTeams', width: 14 },
      { header: 'Tình nguyện viên', key: 'volunteers', width: 18 },
      { header: 'Kỹ năng số', key: 'digitalSkills', width: 14 },
      { header: 'VNeID', key: 'vneidSupport', width: 12 },
      { header: 'DVC Trực tuyến', key: 'publicServices', width: 16 },
      { header: 'QR thanh toán', key: 'qrSupport', width: 15 },
      { header: 'Lớp tập huấn', key: 'trainingClasses', width: 14 },
      { header: 'Sản phẩm số', key: 'digitalProducts', width: 14 },
      { header: 'TN tập AI', key: 'youthTrained', width: 12 },
      { header: 'Đăng ký SmartWeb', key: 'smartwebCount', width: 18 },
      { header: 'Website active', key: 'websitesCreated', width: 16 },
      { header: 'Khó khăn', key: 'issues', width: 30 },
      { header: 'Đề xuất', key: 'proposals', width: 30 },
    ];

    ws.getRow(1).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D3B6E' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    ws.getRow(1).height = 35;

    reports.forEach((r, idx) => {
      const row = ws.addRow({
        agency: r.agencyId?.name || 'Không rõ',
        reporter: r.reporterId?.username || 'Không rõ',
        reportDate: new Date(r.reportDate).toLocaleDateString('vi-VN'),
        activeTeams: r.activeTeams,
        volunteers: r.volunteers,
        digitalSkills: r.digitalSkills,
        vneidSupport: r.vneidSupport,
        publicServices: r.publicServices,
        qrSupport: r.qrSupport,
        trainingClasses: r.trainingClasses,
        digitalProducts: r.digitalProducts,
        youthTrained: r.youthTrained,
        smartwebCount: r.smartwebCount || 0,
        websitesCreated: r.websitesCreated || 0,
        issues: r.issues || '',
        proposals: r.proposals || ''
      });
      if (idx % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F6FF' } };
        });
      }
    });

    // Tổng cộng
    const totalRow = ws.addRow({
      agency: 'TỔNG CỘNG',
      activeTeams: reports.reduce((s, r) => s + r.activeTeams, 0),
      volunteers: reports.reduce((s, r) => s + r.volunteers, 0),
      digitalSkills: reports.reduce((s, r) => s + r.digitalSkills, 0),
      vneidSupport: reports.reduce((s, r) => s + r.vneidSupport, 0),
      publicServices: reports.reduce((s, r) => s + r.publicServices, 0),
      qrSupport: reports.reduce((s, r) => s + r.qrSupport, 0),
      trainingClasses: reports.reduce((s, r) => s + r.trainingClasses, 0),
      digitalProducts: reports.reduce((s, r) => s + r.digitalProducts, 0),
      youthTrained: reports.reduce((s, r) => s + r.youthTrained, 0),
      smartwebCount: reports.reduce((s, r) => s + (r.smartwebCount || 0), 0),
      websitesCreated: reports.reduce((s, r) => s + (r.websitesCreated || 0), 0)
    });
    totalRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
      cell.font = { bold: true };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const dateLabel = date ? date : `${startDate}_${endDate}`;
    res.setHeader('Content-Disposition', `attachment; filename=campaign_report_${dateLabel}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exportExcel:', error);
    res.status(500).json({ message: 'Lỗi xuất Excel' });
  }
};

// Tổng kết DTI — Chỉ số Chuyển đổi số tỉnh
exports.getDtiSummary = async (req, res) => {
  try {
    const SmartwebRegistration = require('../models/SmartwebRegistration');

    const [campaignTotals, smartwebStats] = await Promise.all([
      CampaignReport.aggregate([{
        $group: {
          _id: null,
          totalVneid: { $sum: '$vneidSupport' },
          totalQr: { $sum: '$qrSupport' },
          totalDigitalSkills: { $sum: '$digitalSkills' },
          totalPublicServices: { $sum: '$publicServices' },
          totalSmartWebReported: { $sum: '$smartwebCount' },
          totalWebsitesReported: { $sum: '$websitesCreated' },
          totalVolunteers: { $sum: '$volunteers' },
          totalYouthTrained: { $sum: '$youthTrained' },
          totalDigitalProducts: { $sum: '$digitalProducts' },
          totalTrainingClasses: { $sum: '$trainingClasses' },
          totalMediaPosts: { $sum: '$mediaPosts' },
          totalSafetyCampaigns: { $sum: '$safetyCampaigns' },
          reportCount: { $sum: 1 }
        }
      }]),
      SmartwebRegistration.aggregate([{
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
          registered: { $sum: { $cond: [{ $in: ['$status', ['REGISTERED', 'ACTIVE']] }, 1, 0] } }
        }
      }])
    ]);

    const c = campaignTotals[0] || {};
    const s = smartwebStats[0] || {};

    res.json({
      // Nhóm 1: Kỹ năng số
      digitalSkills: c.totalDigitalSkills || 0,
      youthTrained: c.totalYouthTrained || 0,
      trainingClasses: c.totalTrainingClasses || 0,
      // Nhóm 2: Dịch vụ công
      vneid: c.totalVneid || 0,
      publicServices: c.totalPublicServices || 0,
      // Nhóm 3: Kinh tế số
      qr: c.totalQr || 0,
      digitalProducts: c.totalDigitalProducts || 0,
      smartwebRegistrations: s.total || 0,
      smartwebActive: s.active || 0,
      smartwebRegistered: s.registered || 0,
      // Nhóm 4: Truyền thông
      mediaPosts: c.totalMediaPosts || 0,
      safetyCampaigns: c.totalSafetyCampaigns || 0,
      // Tổng hợp
      volunteers: c.totalVolunteers || 0,
      reportCount: c.reportCount || 0
    });
  } catch (error) {
    console.error('Error getDtiSummary:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};
