const CampaignReport = require('../models/CampaignReport');
const Agency = require('../models/Agency');

// Gửi báo cáo hằng ngày (hoặc cập nhật nếu đã có trong ngày)
exports.submitReport = async (req, res) => {
  try {
    const { 
      reportDate, activeTeams, volunteers, digitalSkills, vneidSupport, 
      publicServices, qrSupport, trainingClasses, digitalProducts, 
      youthTrained, safetyCampaigns, mediaPosts, issues, proposals, evidenceLinks 
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
          totalVneid: { $sum: "$vneidSupport" },
          totalQr: { $sum: "$qrSupport" },
          totalDigitalSkills: { $sum: "$digitalSkills" },
          totalPublicServices: { $sum: "$publicServices" }
        }
      }
    ]);

    // Tính số lượng đội hình ra quân (số xã đã có ít nhất 1 báo cáo)
    const activeAgenciesCount = await CampaignReport.distinct('agencyId').then(arr => arr.length);
    const totalAgencies = await Agency.countDocuments({ type: 'COMMUNE' });

    res.json({
      vneid: stats[0]?.totalVneid || 0,
      qr: stats[0]?.totalQr || 0,
      digitalSkills: stats[0]?.totalDigitalSkills || 0,
      publicServices: stats[0]?.totalPublicServices || 0,
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
