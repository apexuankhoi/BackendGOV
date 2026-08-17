const CampaignReport = require('../models/CampaignReport');
const ExcelJS = require('exceljs');
const Agency = require('../models/Agency');

// Gửi báo cáo hằng ngày (hoặc cập nhật nếu đã có trong ngày)
exports.submitReport = async (req, res) => {
  try {
    const { 
      reportDate,
      // 11 CHỈ TIÊU CHÍNH THỨC
      digitalSkills, vneidSupport, publicServices, qrSupport,
      activeTeams, trainingClasses, digitalModels, digitalProducts,
      youthTrained, youthProjects, smartwebCount,
      // BỔ TRỢ
      volunteers, safetyCampaigns, mediaPosts, websitesCreated,
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
      // 11 CHỈ TIÊU CHÍNH THỨC
      digitalSkills: Number(digitalSkills) || 0,     // 1. Kỹ năng số
      vneidSupport: Number(vneidSupport) || 0,       // 2. VNeID
      publicServices: Number(publicServices) || 0,   // 3. DVC trực tuyến
      qrSupport: Number(qrSupport) || 0,             // 4. QR thanh toán
      activeTeams: Number(activeTeams) || 0,         // 5. Đội hình TN số
      trainingClasses: Number(trainingClasses) || 0, // 6. Lớp tập huấn
      digitalModels: Number(digitalModels) || 0,     // 7. Mô hình điểm CĐS
      digitalProducts: Number(digitalProducts) || 0, // 8. Sản phẩm OCOP/địa phương
      youthTrained: Number(youthTrained) || 0,       // 9. TN tập huấn AI
      youthProjects: Number(youthProjects) || 0,     // 10. Công trình TN CĐS
      smartwebCount: Number(smartwebCount) || 0,     // 11. Website SmartWeb

      // Phụ trợ
      volunteers: Number(volunteers) || 0,
      safetyCampaigns: Number(safetyCampaigns) || 0,
      mediaPosts: Number(mediaPosts) || 0,
      websitesCreated: Number(websitesCreated) || 0,
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

// Thống kê lũy kế toàn tỉnh (đầy đủ 11 chỉ tiêu)
exports.getGlobalStats = async (req, res) => {
  try {
    const stats = await CampaignReport.aggregate([
      {
        $group: {
          _id: null,
          totalDigitalSkills: { $sum: '$digitalSkills' },     // 1. Kỹ năng số
          totalVneid: { $sum: '$vneidSupport' },              // 2. VNeID
          totalPublicServices: { $sum: '$publicServices' },   // 3. DVC trực tuyến
          totalQr: { $sum: '$qrSupport' },                    // 4. QR thanh toán
          totalActiveTeams: { $sum: '$activeTeams' },         // 5. Đội hình TN số
          totalTrainingClasses: { $sum: '$trainingClasses' }, // 6. Lớp tập huấn
          totalDigitalModels: { $sum: '$digitalModels' },     // 7. Mô hình điểm CĐS
          totalDigitalProducts: { $sum: '$digitalProducts' }, // 8. Sản phẩm OCOP/địa phương
          totalYouthTrained: { $sum: '$youthTrained' },       // 9. TN tập huấn AI
          totalYouthProjects: { $sum: '$youthProjects' },     // 10. Công trình TN CĐS
          totalSmartWeb: { $sum: '$smartwebCount' },          // 11. Website SmartWeb
          // Phụ trợ
          totalWebsitesCreated: { $sum: '$websitesCreated' },
          totalVolunteers: { $sum: '$volunteers' },
          totalSafetyCampaigns: { $sum: '$safetyCampaigns' },
          totalMediaPosts: { $sum: '$mediaPosts' }
        }
      }
    ]);

    const activeAgenciesCount = await CampaignReport.distinct('agencyId').then(arr => arr.length);
    const totalAgencies = await Agency.countDocuments({ level: 'COMMUNE' });
    const s = stats[0] || {};

    res.json({
      // 11 chỉ tiêu chính thức
      digitalSkills: s.totalDigitalSkills || 0,
      vneid: s.totalVneid || 0,
      publicServices: s.totalPublicServices || 0,
      qr: s.totalQr || 0,
      activeTeams: s.totalActiveTeams || 0,
      trainingClasses: s.totalTrainingClasses || 0,
      digitalModels: s.totalDigitalModels || 0,
      digitalProducts: s.totalDigitalProducts || 0,
      youthTrained: s.totalYouthTrained || 0,
      youthProjects: s.totalYouthProjects || 0,
      smartwebCount: s.totalSmartWeb || 0,
      // Phụ trợ
      websitesCreated: s.totalWebsitesCreated || 0,
      volunteers: s.totalVolunteers || 0,
      safetyCampaigns: s.totalSafetyCampaigns || 0,
      mediaPosts: s.totalMediaPosts || 0,
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

// Xuất Excel báo cáo chiến dịch (Tỉnh) - Đầy đủ 11 chỉ tiêu
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
      // 11 Chỉ tiêu
      { header: '1. Kỹ năng số', key: 'digitalSkills', width: 15 },
      { header: '2. VNeID mức 2', key: 'vneidSupport', width: 15 },
      { header: '3. DVC Trực tuyến', key: 'publicServices', width: 16 },
      { header: '4. HKD dùng QR', key: 'qrSupport', width: 15 },
      { header: '5. Đội hình TN số', key: 'activeTeams', width: 15 },
      { header: '6. Lớp tập huấn', key: 'trainingClasses', width: 15 },
      { header: '7. Mô hình CĐS', key: 'digitalModels', width: 15 },
      { header: '8. SP OCOP/Địa phương', key: 'digitalProducts', width: 18 },
      { header: '9. TN học AI', key: 'youthTrained', width: 14 },
      { header: '10. Công trình CĐS', key: 'youthProjects', width: 16 },
      { header: '11. Web SmartWeb', key: 'smartwebCount', width: 16 },
      // Phụ trợ
      { header: 'Tình nguyện viên', key: 'volunteers', width: 16 },
      { header: 'An toàn số', key: 'safetyCampaigns', width: 14 },
      { header: 'Bài truyền thông', key: 'mediaPosts', width: 15 },
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
        digitalSkills: r.digitalSkills || 0,
        vneidSupport: r.vneidSupport || 0,
        publicServices: r.publicServices || 0,
        qrSupport: r.qrSupport || 0,
        activeTeams: r.activeTeams || 0,
        trainingClasses: r.trainingClasses || 0,
        digitalModels: r.digitalModels || 0,
        digitalProducts: r.digitalProducts || 0,
        youthTrained: r.youthTrained || 0,
        youthProjects: r.youthProjects || 0,
        smartwebCount: r.smartwebCount || 0,
        volunteers: r.volunteers || 0,
        safetyCampaigns: r.safetyCampaigns || 0,
        mediaPosts: r.mediaPosts || 0,
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
      reporter: '',
      reportDate: `${reports.length} báo cáo`,
      digitalSkills: reports.reduce((s, r) => s + (r.digitalSkills || 0), 0),
      vneidSupport: reports.reduce((s, r) => s + (r.vneidSupport || 0), 0),
      publicServices: reports.reduce((s, r) => s + (r.publicServices || 0), 0),
      qrSupport: reports.reduce((s, r) => s + (r.qrSupport || 0), 0),
      activeTeams: reports.reduce((s, r) => s + (r.activeTeams || 0), 0),
      trainingClasses: reports.reduce((s, r) => s + (r.trainingClasses || 0), 0),
      digitalModels: reports.reduce((s, r) => s + (r.digitalModels || 0), 0),
      digitalProducts: reports.reduce((s, r) => s + (r.digitalProducts || 0), 0),
      youthTrained: reports.reduce((s, r) => s + (r.youthTrained || 0), 0),
      youthProjects: reports.reduce((s, r) => s + (r.youthProjects || 0), 0),
      smartwebCount: reports.reduce((s, r) => s + (r.smartwebCount || 0), 0),
      volunteers: reports.reduce((s, r) => s + (r.volunteers || 0), 0),
      safetyCampaigns: reports.reduce((s, r) => s + (r.safetyCampaigns || 0), 0),
      mediaPosts: reports.reduce((s, r) => s + (r.mediaPosts || 0), 0),
      issues: '',
      proposals: ''
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

// Tổng kết DTI — Chỉ số Chuyển đổi số tỉnh (đầy đủ 11 chỉ tiêu)
exports.getDtiSummary = async (req, res) => {
  try {
    const SmartwebRegistration = require('../models/SmartwebRegistration');

    const [campaignTotals, smartwebStats] = await Promise.all([
      CampaignReport.aggregate([{
        $group: {
          _id: null,
          totalDigitalSkills: { $sum: '$digitalSkills' },     // 1. Kỹ năng số
          totalVneid: { $sum: '$vneidSupport' },              // 2. VNeID
          totalPublicServices: { $sum: '$publicServices' },   // 3. DVC
          totalQr: { $sum: '$qrSupport' },                    // 4. QR thanh toán
          totalActiveTeams: { $sum: '$activeTeams' },         // 5. Đội hình TN số
          totalTrainingClasses: { $sum: '$trainingClasses' }, // 6. Lớp tập huấn
          totalDigitalModels: { $sum: '$digitalModels' },     // 7. Mô hình điểm CĐS
          totalDigitalProducts: { $sum: '$digitalProducts' }, // 8. Sản phẩm số hóa
          totalYouthTrained: { $sum: '$youthTrained' },       // 9. TN học AI
          totalYouthProjects: { $sum: '$youthProjects' },     // 10. Công trình TN CĐS
          totalSmartWebReported: { $sum: '$smartwebCount' },  // 11. Website SmartWeb
          totalWebsitesReported: { $sum: '$websitesCreated' },
          totalVolunteers: { $sum: '$volunteers' },
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
      // 11 chỉ tiêu chính thức
      digitalSkills: c.totalDigitalSkills || 0,
      vneid: c.totalVneid || 0,
      publicServices: c.totalPublicServices || 0,
      qr: c.totalQr || 0,
      activeTeams: c.totalActiveTeams || 0,
      trainingClasses: c.totalTrainingClasses || 0,
      digitalModels: c.totalDigitalModels || 0,
      digitalProducts: c.totalDigitalProducts || 0,
      youthTrained: c.totalYouthTrained || 0,
      youthProjects: c.totalYouthProjects || 0,
      smartwebCount: Math.max(c.totalSmartWebReported || 0, s.total || 0),

      // Dữ liệu mở rộng SmartWeb
      smartwebRegistrations: s.total || 0,
      smartwebActive: s.active || 0,
      smartwebRegistered: s.registered || 0,
      websitesCreated: c.totalWebsitesReported || 0,

      // Phụ trợ
      volunteers: c.totalVolunteers || 0,
      mediaPosts: c.totalMediaPosts || 0,
      safetyCampaigns: c.totalSafetyCampaigns || 0,
      reportCount: c.reportCount || 0
    });
  } catch (error) {
    console.error('Error getDtiSummary:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};
