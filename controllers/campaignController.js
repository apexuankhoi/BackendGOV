const CampaignReport = require('../models/CampaignReport');
const ExcelJS = require('exceljs');
const Agency = require('../models/Agency');
const Team = require('../models/Team');
const SystemConfig = require('../models/SystemConfig');
const ActivityLog = require('../models/ActivityLog');

// Helper parse "HH:mm" thành số phút trong ngày
function parseTimeToMinutes(timeStr, defaultMinutes) {
  if (!timeStr || !timeStr.includes(':')) return defaultMinutes;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return defaultMinutes;
  return h * 60 + m;
}

// Helper chuẩn hóa dải thời gian một ngày theo UTC (tránh lệch ngày do timezone +07:00)
function getDayRange(dateInput) {
  let y, m, d;

  if (!dateInput) {
    // Lấy ngày hiện tại theo giờ Việt Nam (UTC+7)
    const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
    y = now.getUTCFullYear();
    m = now.getUTCMonth() + 1;
    d = now.getUTCDate();
  } else if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    [y, m, d] = dateInput.split('-').map(Number);
  } else {
    const dt = new Date(dateInput);
    // Đổi sang giờ VN để lấy đúng ngày
    const vnDate = new Date(dt.getTime() + 7 * 60 * 60 * 1000);
    y = vnDate.getUTCFullYear();
    m = vnDate.getUTCMonth() + 1;
    d = vnDate.getUTCDate();
  }

  // Lưu theo UTC midnight → MongoDB hiển thị đúng ngày, không bị lệch
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const end   = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  const normalized = new Date(start);

  return { start, end, normalized };
}

// Lấy hoặc tạo cấu hình mặc định
async function getCampaignReportingConfig() {
  let config = await SystemConfig.findOne({ key: 'campaign_reporting' });
  if (!config) {
    config = await SystemConfig.create({
      key: 'campaign_reporting',
      openTime: '13:00',
      closeTime: '18:30',
      editDeadline: '19:00',
      alwaysOpen: false
    });
  }
  return config;
}

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

    const User = require('../models/User');
    let currentUser = await User.findById(req.user.userId || req.user._id);



    // ─── AUTO-RECOVERY: JWT hợp lệ nhưng User đã bị xóa khỏi DB ────────────
    // Thay vì báo lỗi, tự động tái tạo User record từ JWT + commune body
    if (!currentUser) {
      const communeFromBody = req.body.commune;
      const communeFromHeader = req.headers['x-commune'];
      const recoverCommune = communeFromBody || communeFromHeader || '';
      const recoverRole = req.user.role || 'COMMUNE_ADMIN';
      const userId = req.user.userId || req.user._id;



      // Tìm hoặc tạo Agency trước
      let recoverAgency = null;
      if (recoverCommune) {
        const clean = recoverCommune.replace(/^(Xã|Phường|Đoàn xã|Đoàn phường)\s*/i, '').trim();
        recoverAgency = await Agency.findOne({ name: recoverCommune });
        if (!recoverAgency) recoverAgency = await Agency.findOne({ name: { $regex: `^${clean}$`, $options: 'i' } });
        if (!recoverAgency) recoverAgency = await Agency.findOne({ name: { $regex: clean, $options: 'i' } });
        if (!recoverAgency) {
          recoverAgency = await Agency.create({ name: recoverCommune, level: 'COMMUNE', description: `${recoverCommune} - Tự động tạo khi phục hồi` });
        }
      }

      // Tạo lại User với cùng ObjectId từ JWT để token cũ vẫn hoạt động
      try {
        const mongoose = require('mongoose');
        const recoveredId = new mongoose.Types.ObjectId(userId);
        currentUser = await User.create({
          _id: recoveredId,
          username: recoverCommune || `Recovered_${String(userId).slice(-6)}`,
          email: `recovered_${String(userId).slice(-6)}@webgov.local`,
          password: `$2a$10$placeholder_hashed_password_${String(userId).slice(-6)}`,
          role: recoverRole,
          agencyId: recoverAgency?._id || null,
          locationContext: { province: 'Đắk Lắk', commune: recoverCommune }
        });

      } catch (recoverErr) {
        // Nếu _id bị conflict (trùng), thử findById lại
        currentUser = await User.findById(userId);
        if (!currentUser) {

          return res.status(403).json({
            message: '⚠️ Không thể khôi phục tài khoản. Vui lòng đăng xuất và đăng nhập lại.',
            code: 'RECOVERY_FAILED'
          });
        }
      }
    }

    // ─── QUAN TRỌNG: Luôn ưu tiên agencyId từ DB, không tin JWT ─────────────
    // Lý do: JWT có thể chứa agencyId CŨ (trước khi seed.js xóa dữ liệu).
    let agencyId = currentUser.agencyId || req.user.agencyId || null;



    // ─── BƯỚC 1: Xác thực agencyId hiện tại có tồn tại trong DB không ───────
    let validAgency = null;
    if (agencyId) {
      validAgency = await Agency.findById(agencyId);
      if (validAgency) {
        // ok
      } else {
        agencyId = null; // Reset để các bước fallback chạy
      }
    }

    // ─── BƯỚC 2: Tìm theo locationContext.commune trong DB ───────────────────
    if (!validAgency && currentUser?.locationContext?.commune) {
      const comm = currentUser.locationContext.commune;
      const clean = comm.replace(/^(Xã|Phường|Đoàn xã|Đoàn phường)\s*/i, '').trim();
      let matchedAgency = await Agency.findOne({ name: comm });
      if (!matchedAgency) matchedAgency = await Agency.findOne({ name: { $regex: `^${clean}$`, $options: 'i' } });
      if (!matchedAgency) matchedAgency = await Agency.findOne({ name: { $regex: clean, $options: 'i' } });
      if (matchedAgency) {
        validAgency = matchedAgency;
        agencyId = matchedAgency._id;
        // Cập nhật lại DB để lần sau không phải tìm nữa
        currentUser.agencyId = agencyId;
        await currentUser.save();
      }
    }

    // ─── BƯỚC 3: Tìm theo commune gửi từ Frontend ────────────────────────────
    if (!validAgency && req.body.commune) {
      const bodyComm = req.body.commune;
      const bodyClean = bodyComm.replace(/^(Xã|Phường|Đoàn xã|Đoàn phường)\s*/i, '').trim();
      let matchedAgency = await Agency.findOne({ name: bodyComm });
      if (!matchedAgency) matchedAgency = await Agency.findOne({ name: { $regex: `^${bodyClean}$`, $options: 'i' } });
      if (!matchedAgency) matchedAgency = await Agency.findOne({ name: { $regex: bodyClean, $options: 'i' } });
      if (matchedAgency) {
        validAgency = matchedAgency;
        agencyId = matchedAgency._id;
        if (currentUser) { currentUser.agencyId = agencyId; await currentUser.save(); }

      }
    }

    // ─── BƯỚC 4: Tìm theo agencyId gửi từ Frontend ───────────────────────────
    if (!validAgency && req.body.agencyId) {
      const candidate = await Agency.findById(req.body.agencyId);
      if (candidate) {
        validAgency = candidate;
        agencyId = candidate._id;

      }
    }

    // ─── BƯỚC 5 (CUỐI): Tự động tạo Agency nếu có đủ thông tin commune ──────
    if (!validAgency) {
      const communeName = currentUser?.locationContext?.commune || req.body.commune;

      if (communeName) {
        validAgency = await Agency.create({
          name: communeName,
          level: 'COMMUNE',
          description: `${communeName} - Tự động tạo`
        });
        agencyId = validAgency._id;
        if (currentUser) { currentUser.agencyId = agencyId; await currentUser.save(); }

      }
    }

    // ─── Không tìm được sau tất cả các bước ──────────────────────────────────
    if (!validAgency) {

      return res.status(403).json({
        message: '⚠️ Tài khoản chưa được liên kết với Đơn vị Xã/Phường. Vui lòng liên hệ Quản trị viên Tỉnh Đoàn để được gắn đơn vị.',
        hint: 'Cần bổ sung thông tin Xã/Phường công tác trong phần Thông tin tài khoản.'
      });
    }

    agencyId = validAgency._id;


    // 1. Kiểm tra BẮT BUỘC có Link minh chứng
    let cleanEvidenceLinks = (evidenceLinks || '').trim();
    if (!cleanEvidenceLinks) {
      return res.status(400).json({ 
        message: '⚠️ BẮT BUỘC: Bạn phải đính kèm Link minh chứng (Link Google Drive, hình ảnh, tài liệu ra quân) khi nộp báo cáo.' 
      });
    }

    // Tự động chuẩn hóa link
    if (!/^https?:\/\//i.test(cleanEvidenceLinks)) {
      cleanEvidenceLinks = 'https://' + cleanEvidenceLinks;
    }

    // 2. Chuẩn hóa ngày báo cáo theo dải thời gian chuẩn
    const range = getDayRange(reportDate || Date.now());

    const existingReport = await CampaignReport.findOne({ 
      agencyId, 
      reportDate: { $gte: range.start, $lte: range.end } 
    });


    // 3. Kiểm tra khung giờ từ Cấu hình Động của Hệ thống
    const config = await getCampaignReportingConfig();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // ── Kiểm tra allowLateDate: Cho phép nộp muộn cho ngày cụ thể ─────────
    // Admin set allowLateDate = 'YYYY-MM-DD' để mở cổng cho ngày đó
    const isLateAllowed = config.allowLateDate && reportDate && (
      config.allowLateDate === reportDate ||
      new Date(config.allowLateDate).toDateString() === new Date(reportDate).toDateString()
    );



    if (!config.alwaysOpen && !isLateAllowed) {
      const openMinutes = parseTimeToMinutes(config.openTime, 13 * 60);
      const closeMinutes = parseTimeToMinutes(config.closeTime, 18 * 60 + 30);
      const editMinutes = parseTimeToMinutes(config.editDeadline || config.closeTime, 19 * 60);

      if (currentMinutes < openMinutes) {
        return res.status(403).json({ 
          message: `Cổng báo cáo chưa mở. Thời gian nhận báo cáo bắt đầu từ ${config.openTime} hằng ngày.`,
          config: { openTime: config.openTime, closeTime: config.closeTime, editDeadline: config.editDeadline, alwaysOpen: config.alwaysOpen }
        });
      }

      if (existingReport && currentMinutes > editMinutes) {
        return res.status(403).json({ 
          message: `Đã quá hạn chỉnh sửa báo cáo hôm nay (Hạn chót chỉnh sửa là ${config.editDeadline || config.closeTime}).`,
          config: { openTime: config.openTime, closeTime: config.closeTime, editDeadline: config.editDeadline, alwaysOpen: config.alwaysOpen }
        });
      }

      if (!existingReport && currentMinutes > closeMinutes) {
        return res.status(403).json({ 
          message: `Cổng nộp báo cáo mới hôm nay đã đóng lúc ${config.closeTime}. Vui lòng liên hệ Tỉnh nếu cần gia hạn.`,
          config: { openTime: config.openTime, closeTime: config.closeTime, editDeadline: config.editDeadline, alwaysOpen: config.alwaysOpen }
        });
      }
    }



    const updateData = {
      agencyId,
      reporterId: req.user?.userId || req.user?._id,
      reportDate: range.normalized,
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
      evidenceLinks: cleanEvidenceLinks,
      reporterName: req.user?.fullName || req.user?.username || '',
      updatedAt: Date.now()
    };

    let report;
    if (existingReport) {
      report = await CampaignReport.findByIdAndUpdate(
        existingReport._id,
        updateData,
        { returnDocument: 'after' }
      );
    } else {
      report = await CampaignReport.create(updateData);
    }
    console.log(`[submitReport] ✅ ${existingReport ? 'UPDATE' : 'CREATE'} | User: ${currentUser?.email} | Commune: ${validAgency?.name} | AgencyId: ${agencyId} | ReportId: ${report?._id}`);

    // 3. Tự động khởi tạo / Cập nhật Đội hình Thanh niên số của xã tương ứng vào bảng Team
    try {
      const agency = await Agency.findById(agencyId);
      if (agency) {
        const communeName = agency.name;
        const reporterId = req.user?.userId || req.user?._id;

        // Suy luận huyện từ tên xã nếu chưa có
        let districtName = req.user?.locationContext?.district || 'Đắk Lắk';
        if (districtName === 'Đắk Lắk' || !districtName) {
          if (communeName.includes('Buôn Ma Thuột') || communeName.includes('Tân An') || communeName.includes('Tân Lập') || communeName.includes('Thành Nhất') || communeName.includes('Ea Kao') || communeName.includes('Hòa Phú')) {
            districtName = 'TP Buôn Ma Thuột';
          } else if (communeName.includes('Buôn Hồ') || communeName.includes('Cư Bao') || communeName.includes('Ea Drông')) {
            districtName = 'TX Buôn Hồ';
          } else if (communeName.includes('Ea Súp') || communeName.includes('Ea Rốk') || communeName.includes('Ea Bung') || communeName.includes('Ia Rvê') || communeName.includes('Ia Lốp')) {
            districtName = 'Huyện Ea Súp';
          } else if (communeName.includes('Ea Wer') || communeName.includes('Ea Nuôl') || communeName.includes('Buôn Đôn')) {
            districtName = 'Huyện Buôn Đôn';
          } else if (communeName.includes('Ea Kiết') || communeName.includes('Ea M\'Droh') || communeName.includes('Quảng Phú') || communeName.includes('Cuôr Đăng') || communeName.includes('Cư M\'gar') || communeName.includes('Ea Tul')) {
            districtName = 'Huyện Cư M\'gar';
          } else if (communeName.includes('Pơng Drang') || communeName.includes('Krông Búk') || communeName.includes('Cư Pơng')) {
            districtName = 'Huyện Krông Búk';
          } else if (communeName.includes('Ea Khal') || communeName.includes('Ea Drăng') || communeName.includes('Ea Wy') || communeName.includes('Ea H\'Leo') || communeName.includes('Ea Hiao')) {
            districtName = "Huyện Ea H'leo";
          } else if (communeName.includes('Krông Năng') || communeName.includes('Dliê Ya') || communeName.includes('Tam Giang') || communeName.includes('Phú Xuân')) {
            districtName = 'Huyện Krông Năng';
          } else if (communeName.includes('Krông Pắc') || communeName.includes('Ea Knuếc') || communeName.includes('Tân Tiến') || communeName.includes('Ea Phê') || communeName.includes('Ea Kly') || communeName.includes('Vụ Bổn')) {
            districtName = 'Huyện Krông Pắc';
          } else if (communeName.includes('Ea Kar') || communeName.includes('Ea Ô') || communeName.includes('Ea Knốp') || communeName.includes('Cư Yang') || communeName.includes('Ea Păl')) {
            districtName = 'Huyện Ea Kar';
          } else if (communeName.includes('M\'Drắk') || communeName.includes('Ea Riêng') || communeName.includes('Cư M\'ta') || communeName.includes('Krông Á') || communeName.includes('Cư Prao') || communeName.includes('Ea Trang')) {
            districtName = "Huyện M'Đrắk";
          } else if (communeName.includes('Hòa Sơn') || communeName.includes('Dang Kang') || communeName.includes('Krông Bông') || communeName.includes('Yang Mao') || communeName.includes('Cư Pui')) {
            districtName = 'Huyện Krông Bông';
          } else if (communeName.includes('Liên Sơn') || communeName.includes('Đắk Liêng') || communeName.includes('Nam Ka') || communeName.includes('Đắk Phơi')) {
            districtName = 'Huyện Lắk';
          } else if (communeName.includes('Krông Nô') || communeName.includes('Ea Ning') || communeName.includes('Dray Bhăng') || communeName.includes('Ea Ktur') || communeName.includes('Krông Ana') || communeName.includes('Dur Kmăl') || communeName.includes('Ea Na')) {
            districtName = 'Huyện Krông Ana';
          } else {
            districtName = 'Đắk Lắk';
          }
        }

        const teamName = `Đội hình Thanh niên số ${communeName}`;
        const totalBeneficiaries = (Number(digitalSkills) || 0) + (Number(vneidSupport) || 0) + (Number(publicServices) || 0);

        await Team.findOneAndUpdate(
          { 'location.commune': communeName },
          {
            name: teamName,
            schoolOrUnit: `Đoàn cơ sở ${communeName}`,
            createdBy: reporterId,
            agencyId,
            reporterName: req.user?.fullName || req.user?.username || `Cán bộ Đoàn ${communeName}`,
            evidenceLinks: evidenceLinks || '',
            kpiSummary: {
              digitalSkills: Number(digitalSkills) || 0,
              vneidSupport: Number(vneidSupport) || 0,
              publicServices: Number(publicServices) || 0,
              qrSupport: Number(qrSupport) || 0,
              smartwebCount: Number(smartwebCount) || 0
            },
            fieldsOfActivity: [
              'Chuyển đổi số cộng đồng',
              'Hướng dẫn VNeID & DVC trực tuyến',
              'Phổ cập mã QR thanh toán không tiền mặt',
              'Tập huấn AI & Kỹ năng số'
            ],
            location: {
              province: 'Đắk Lắk',
              district: districtName,
              commune: communeName,
              type: communeName.includes('Phường') ? 'Đô thị' : 'Nông thôn'
            },
            timeframe: {
              startDate: new Date('2026-08-01'),
              endDate: new Date('2026-09-13')
            },
            statistics: {
              volunteersCount: Number(volunteers) || 15,
              projectsCount: Number(youthProjects) || 1,
              estimatedValue: Math.round(((Number(publicServices) || 0) * 0.05 + (Number(digitalSkills) || 0) * 0.02) * 10) / 10 || 5,
              beneficiaries: totalBeneficiaries || 50
            },
            status: 'APPROVED',
            updatedAt: Date.now()
          },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
      }
    } catch (teamErr) {
      console.error('Error auto-syncing Team:', teamErr);
    }

    res.json({ message: 'Lưu báo cáo thành công', report });
  } catch (error) {
    console.error('Error submitReport:', error);
    res.status(500).json({ message: 'Lỗi server khi lưu báo cáo' });
  }
};

// Lấy báo cáo của đơn vị trong ngày đã chọn (hỗ trợ xem lại các ngày trước)
exports.getMyReport = async (req, res) => {
  try {
    const agencyId = req.user.agencyId;
    if (!agencyId) return res.json(null);

    const { date } = req.query;
    const range = getDayRange(date || Date.now());

    const report = await CampaignReport.findOne({ 
      agencyId, 
      reportDate: { $gte: range.start, $lte: range.end } 
    }).populate('agencyId', 'name district').populate('reporterId', 'username email');

    res.json(report);
  } catch (error) {
    console.error('Error getMyReport:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy toàn bộ lịch sử báo cáo của đơn vị mình theo từng ngày (từ mới nhất đến cũ nhất)
exports.getMyHistory = async (req, res) => {
  try {
    const agencyId = req.user.agencyId;
    if (!agencyId) return res.json([]);

    const reports = await CampaignReport.find({ agencyId })
      .populate('agencyId', 'name district')
      .populate('reporterId', 'username email')
      .sort({ reportDate: -1, createdAt: -1 });

    res.json(reports);
  } catch (error) {
    console.error('Error getMyHistory:', error);
    res.status(500).json({ message: 'Lỗi lấy lịch sử báo cáo' });
  }
};

// Thống kê toàn tỉnh: Cả Lũy kế và Số liệu trong ngày
exports.getGlobalStats = async (req, res) => {
  try {
    const { date } = req.query;
    const range = getDayRange(date || Date.now());

    const [cumStatsAgg, dailyStatsAgg, activeAgenciesCount, rawTotalAgencies] = await Promise.all([
      CampaignReport.aggregate([
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
      ]),
      CampaignReport.aggregate([
        {
          $match: { 
            reportDate: { $gte: range.start, $lte: range.end } 
          }
        },
        {
          $group: {
            _id: null,
            totalDigitalSkills: { $sum: '$digitalSkills' },
            totalVneid: { $sum: '$vneidSupport' },
            totalPublicServices: { $sum: '$publicServices' },
            totalQr: { $sum: '$qrSupport' },
            totalActiveTeams: { $sum: '$activeTeams' },
            totalTrainingClasses: { $sum: '$trainingClasses' },
            totalDigitalModels: { $sum: '$digitalModels' },
            totalDigitalProducts: { $sum: '$digitalProducts' },
            totalYouthTrained: { $sum: '$youthTrained' },
            totalYouthProjects: { $sum: '$youthProjects' },
            totalSmartWeb: { $sum: '$smartwebCount' },
            totalWebsitesCreated: { $sum: '$websitesCreated' },
            totalVolunteers: { $sum: '$volunteers' },
            totalSafetyCampaigns: { $sum: '$safetyCampaigns' },
            totalMediaPosts: { $sum: '$mediaPosts' },
            agencies: { $addToSet: '$agencyId' }
          }
        }
      ]),
      CampaignReport.distinct('agencyId').then(arr => arr.length),
      Agency.countDocuments({ level: 'COMMUNE' })
    ]);

    const totalAgencies = rawTotalAgencies >= 102 ? 102 : (rawTotalAgencies || 102);
    const c = cumStatsAgg[0] || {};
    const d = dailyStatsAgg[0] || {};
    const dailyReportedCount = d.agencies ? d.agencies.length : 0;

    const cumulative = {
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
      smartwebCount: c.totalSmartWeb || 0,
      websitesCreated: c.totalWebsitesCreated || 0,
      volunteers: c.totalVolunteers || 0,
      safetyCampaigns: c.totalSafetyCampaigns || 0,
      mediaPosts: c.totalMediaPosts || 0,
      activeAgencies: activeAgenciesCount,
      totalAgencies: totalAgencies
    };

    const daily = {
      date: range.normalized,
      digitalSkills: d.totalDigitalSkills || 0,
      vneid: d.totalVneid || 0,
      publicServices: d.totalPublicServices || 0,
      qr: d.totalQr || 0,
      activeTeams: d.totalActiveTeams || 0,
      trainingClasses: d.totalTrainingClasses || 0,
      digitalModels: d.totalDigitalModels || 0,
      digitalProducts: d.totalDigitalProducts || 0,
      youthTrained: d.totalYouthTrained || 0,
      youthProjects: d.totalYouthProjects || 0,
      smartwebCount: d.totalSmartWeb || 0,
      websitesCreated: d.totalWebsitesCreated || 0,
      volunteers: d.totalVolunteers || 0,
      safetyCampaigns: d.totalSafetyCampaigns || 0,
      mediaPosts: d.totalMediaPosts || 0,
      reportedCount: dailyReportedCount,
      unreportedCount: Math.max(0, totalAgencies - dailyReportedCount)
    };

    res.json({
      // Flat fields for backwards compatibility
      ...cumulative,
      cumulative,
      daily
    });
  } catch (error) {
    console.error('Error getGlobalStats:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy danh sách tiến độ báo cáo và link minh chứng của 102 Xã/Phường
exports.getCommunesReportStatus = async (req, res) => {
  try {
    const { date } = req.query;
    const range = getDayRange(date || Date.now());

    // Lấy danh sách các xã/phường
    const communes = await Agency.find({ level: 'COMMUNE' })
      .select('name level province district')
      .sort({ name: 1 })
      .lean();

    // Lấy báo cáo theo dải ngày
    const reports = await CampaignReport.find({ 
      reportDate: { $gte: range.start, $lte: range.end } 
    })
      .populate('reporterId', 'username email')
      .lean();

    const reportMap = new Map();
    reports.forEach(r => {
      if (r.agencyId) reportMap.set(String(r.agencyId), r);
    });

    const result = communes.map(c => {
      const rep = reportMap.get(String(c._id));
      return {
        _id: c._id,
        agencyName: c.name,
        district: c.district || '',
        hasReported: !!rep,
        reportId: rep?._id || null,
        reportDate: range.normalized,
        reporterName: rep?.reporterId?.username || rep?.reporterName || '',
        evidenceLinks: rep?.evidenceLinks || '',
        issues: rep?.issues || '',
        proposals: rep?.proposals || '',
        digitalSkills: rep?.digitalSkills || 0,
        vneidSupport: rep?.vneidSupport || 0,
        publicServices: rep?.publicServices || 0,
        qrSupport: rep?.qrSupport || 0,
        activeTeams: rep?.activeTeams || 0,
        trainingClasses: rep?.trainingClasses || 0,
        digitalModels: rep?.digitalModels || 0,
        digitalProducts: rep?.digitalProducts || 0,
        youthTrained: rep?.youthTrained || 0,
        youthProjects: rep?.youthProjects || 0,
        smartwebCount: rep?.smartwebCount || 0,
        volunteers: rep?.volunteers || 0,
        updatedAt: rep?.updatedAt || null
      };
    });

    const reportedCount = result.filter(r => r.hasReported).length;
    const totalCount = result.length > 0 ? result.length : 102;

    res.json({
      date: range.normalized,
      totalCount: totalCount > 102 ? 102 : totalCount,
      reportedCount,
      unreportedCount: Math.max(0, (totalCount > 102 ? 102 : totalCount) - reportedCount),
      communes: result
    });
  } catch (error) {
    console.error('Error getCommunesReportStatus:', error);
    res.status(500).json({ message: 'Lỗi lấy danh sách báo cáo các xã' });
  }
};

// Dành cho cấp Tỉnh xem báo cáo của tất cả các xã
exports.getAllReports = async (req, res) => {
  try {
    const { date } = req.query;
    const range = getDayRange(date || Date.now());

    let reports = await CampaignReport.find({ 
      reportDate: { $gte: range.start, $lte: range.end } 
    })
      .populate('agencyId', 'name level district')
      .populate('reporterId', 'username email role locationContext')
      .sort({ updatedAt: -1 });

    // Tự động khôi phục & gán đơn vị (Auto-repair) nếu phát hiện bất kỳ báo cáo nào bị khuyết agencyId
    for (let r of reports) {
      if (!r.agencyId) {
        const commCandidate = r.reporterId?.locationContext?.commune || (r.reporterName ? r.reporterName.replace(/^Cán bộ Đoàn\s*/i, '') : '');
        if (commCandidate) {
          const clean = commCandidate.replace(/^(Xã|Phường|Đoàn xã|Đoàn phường)\s*/i, '').trim();
          const found = await Agency.findOne({
            $or: [
              { name: commCandidate },
              { name: { $regex: clean, $options: 'i' } }
            ]
          });
          if (found) {
            await CampaignReport.updateOne({ _id: r._id }, { $set: { agencyId: found._id } });
            r.agencyId = found;
          }
        }
      }
    }

    res.json(reports);
  } catch (error) {
    console.error('Error getAllReports:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// Xóa báo cáo sai / báo cáo rác (Dành cho Super Admin / Admin)
exports.deleteReport = async (req, res) => {
  try {
    const role = req.user?.role;
    if (!['SENIOR_ADMIN', 'ADMIN', 'PROVINCE_ADMIN'].includes(role)) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa báo cáo.' });
    }

    const { id } = req.params;
    const report = await CampaignReport.findByIdAndDelete(id);
    if (!report) {
      return res.status(404).json({ message: 'Không tìm thấy báo cáo cần xóa.' });
    }

    res.json({ message: '✅ Đã xóa báo cáo thành công!' });
  } catch (error) {
    console.error('Error deleteReport:', error);
    res.status(500).json({ message: 'Lỗi server khi xóa báo cáo' });
  }
};

// Gán / Cập nhật Đơn vị (Agency) cho báo cáo - Dành cho Super Admin / Admin
exports.assignAgencyToReport = async (req, res) => {
  try {
    const role = req.user?.role;
    if (!['SENIOR_ADMIN', 'ADMIN', 'PROVINCE_ADMIN'].includes(role)) {
      return res.status(403).json({ message: 'Chỉ Super Admin / Quản trị viên mới có quyền gán đơn vị cho báo cáo.' });
    }

    const { id } = req.params;
    const { agencyId } = req.body;

    if (!agencyId) {
      return res.status(400).json({ message: 'Vui lòng chọn đơn vị cần gán.' });
    }

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return res.status(404).json({ message: 'Không tìm thấy đơn vị được chọn.' });
    }

    const report = await CampaignReport.findById(id);
    if (!report) {
      return res.status(404).json({ message: 'Không tìm thấy báo cáo cần cập nhật.' });
    }

    // Cập nhật AgencyId và snapshot reporterName nếu cần
    report.agencyId = agency._id;
    if (!report.reporterName || report.reporterName.startsWith('Cán bộ Đoàn') || report.reporterName === 'Không xác định') {
      report.reporterName = `Cán bộ Đoàn ${agency.name}`;
    }
    report.updatedAt = Date.now();
    await report.save();

    // Tự động đồng bộ Đội hình Team tương ứng của xã
    try {
      const communeName = agency.name;
      const teamName = `Đội hình Thanh niên số ${communeName}`;
      await Team.findOneAndUpdate(
        { 'location.commune': communeName },
        {
          name: teamName,
          schoolOrUnit: `Đoàn cơ sở ${communeName}`,
          agencyId: agency._id,
          reporterName: report.reporterName,
          evidenceLinks: report.evidenceLinks || '',
          kpiSummary: {
            digitalSkills: report.digitalSkills || 0,
            vneidSupport: report.vneidSupport || 0,
            publicServices: report.publicServices || 0,
            qrSupport: report.qrSupport || 0,
            smartwebCount: report.smartwebCount || 0
          },
          location: {
            province: 'Đắk Lắk',
            district: agency.district || 'Đắk Lắk',
            commune: communeName
          }
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    } catch (teamErr) {
      console.error('Lỗi sync Team khi gán agency:', teamErr);
    }

    const updatedReport = await CampaignReport.findById(id)
      .populate('agencyId', 'name level district')
      .populate('reporterId', 'username email role locationContext');

    res.json({ 
      message: `✅ Đã gán đơn vị "${agency.name}" cho báo cáo thành công!`, 
      report: updatedReport 
    });
  } catch (error) {
    console.error('Error assignAgencyToReport:', error);
    res.status(500).json({ message: 'Lỗi server khi gán đơn vị cho báo cáo' });
  }
};

// Xuất Excel báo cáo chiến dịch (Tỉnh) - Đầy đủ 11 chỉ tiêu + Filter nâng cao
exports.exportExcel = async (req, res) => {
  try {
    const { 
      date, startDate, endDate,
      filterStatus = 'reported',   // 'reported' | 'not_reported' | 'all'
      includeEvidence = 'true',    // link minh chứng
      includeDifficulties = 'true', // khó khăn + đề xuất
      includeProposals = 'true',
    } = req.query;

    let dateFilter = {};
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      dateFilter.reportDate = d;
    } else if (startDate && endDate) {
      dateFilter.reportDate = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

    // ── Lấy báo cáo đã nộp ─────────────────────────────────────────────────
    const reports = await CampaignReport.find(dateFilter)
      .populate('agencyId', 'name')
      .populate('reporterId', 'username email')
      .sort({ reportDate: -1, updatedAt: -1 });

    // ── Lấy tất cả đơn vị cấp xã ───────────────────────────────────────────
    const allAgencies = await Agency.find({ level: 'COMMUNE' }).lean();
    const reportedAgencyIds = new Set(reports.map(r => String(r.agencyId?._id || r.agencyId)));
    const notReportedAgencies = allAgencies.filter(a => !reportedAgencyIds.has(String(a._id)));

    const wb = new ExcelJS.Workbook();

    // ═══════════════════════════════════════════════════════════════════════
    // SHEET 1: Báo cáo đã nộp
    // ═══════════════════════════════════════════════════════════════════════
    if (filterStatus === 'reported' || filterStatus === 'all') {
      const ws = wb.addWorksheet('✅ Đã báo cáo');

      // Định nghĩa cột
      const cols = [
        { header: 'Đơn vị', key: 'agency', width: 28 },
        { header: 'Người nộp', key: 'reporter', width: 18 },
        { header: 'Ngày báo cáo', key: 'reportDate', width: 14 },
        // 11 Chỉ tiêu
        { header: '1. Kỹ năng số', key: 'digitalSkills', width: 14 },
        { header: '2. VNeID mức 2', key: 'vneidSupport', width: 14 },
        { header: '3. DVC TT', key: 'publicServices', width: 14 },
        { header: '4. HKD QR', key: 'qrSupport', width: 13 },
        { header: '5. Đội hình', key: 'activeTeams', width: 13 },
        { header: '6. Lớp tập huấn', key: 'trainingClasses', width: 14 },
        { header: '7. Mô hình', key: 'digitalModels', width: 13 },
        { header: '8. SP OCOP', key: 'digitalProducts', width: 14 },
        { header: '9. TN học AI', key: 'youthTrained', width: 13 },
        { header: '10. Công trình', key: 'youthProjects', width: 13 },
        { header: '11. SmartWeb', key: 'smartwebCount', width: 13 },
        // Phụ trợ
        { header: 'TNV', key: 'volunteers', width: 10 },
        { header: 'An toàn số', key: 'safetyCampaigns', width: 12 },
        { header: 'Bài TT', key: 'mediaPosts', width: 10 },
      ];

      if (includeEvidence === 'true') {
        cols.push({ header: '🔗 Link Minh chứng', key: 'evidenceLinks', width: 40 });
      }
      if (includeDifficulties === 'true') {
        cols.push({ header: '⚠️ Khó khăn', key: 'issues', width: 35 });
      }
      if (includeProposals === 'true') {
        cols.push({ header: '💡 Đề xuất', key: 'proposals', width: 35 });
      }

      ws.columns = cols;

      // Header style
      ws.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D3B6E' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      ws.getRow(1).height = 38;

      // Data rows
      reports.forEach((r, idx) => {
        const rowData = {
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
        };
        if (includeEvidence === 'true') rowData.evidenceLinks = r.evidenceLinks || '';
        if (includeDifficulties === 'true') rowData.issues = r.issues || '';
        if (includeProposals === 'true') rowData.proposals = r.proposals || '';

        const row = ws.addRow(rowData);

        // Link cell clickable nếu có
        if (includeEvidence === 'true' && r.evidenceLinks) {
          const lastColIdx = cols.findIndex(c => c.key === 'evidenceLinks') + 1;
          if (lastColIdx > 0) {
            const cell = row.getCell(lastColIdx);
            cell.value = { text: r.evidenceLinks, hyperlink: r.evidenceLinks };
            cell.font = { color: { argb: 'FF2563EB' }, underline: true };
          }
        }

        if (idx % 2 === 1) {
          row.eachCell(cell => {
            if (!cell.font?.underline) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F6FF' } };
            }
          });
        }
      });

      // Tổng cộng
      if (reports.length > 0) {
        const totalRow = ws.addRow({
          agency: `TỔNG (${reports.length} đơn vị)`,
          reporter: '', reportDate: '',
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
          evidenceLinks: '', issues: '', proposals: ''
        });
        totalRow.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
          cell.font = { bold: true, size: 12 };
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SHEET 2: Chưa báo cáo
    // ═══════════════════════════════════════════════════════════════════════
    if (filterStatus === 'not_reported' || filterStatus === 'all') {
      const ws2 = wb.addWorksheet('❌ Chưa báo cáo');
      ws2.columns = [
        { header: 'Tên Đơn vị', key: 'name', width: 35 },
        { header: 'Cấp', key: 'level', width: 14 },
        { header: 'Ghi chú', key: 'note', width: 30 },
      ];
      ws2.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      ws2.getRow(1).height = 35;

      notReportedAgencies.sort((a, b) => a.name.localeCompare(b.name, 'vi')).forEach((ag, idx) => {
        const row = ws2.addRow({
          name: ag.name,
          level: ag.level === 'COMMUNE' ? 'Xã/Phường' : ag.level,
          note: 'Chưa nộp báo cáo'
        });
        if (idx % 2 === 1) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5F5' } };
          });
        }
      });
      ws2.addRow({});
      const sumRow = ws2.addRow({ name: `Tổng chưa báo cáo: ${notReportedAgencies.length} đơn vị`, level: '', note: '' });
      sumRow.getCell(1).font = { bold: true, color: { argb: 'FFDC2626' }, size: 12 };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const dateLabel = date ? date : (startDate ? `${startDate}_${endDate}` : 'tat_ca');
    res.setHeader('Content-Disposition', `attachment; filename=bao_cao_chien_dich_${dateLabel}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exportExcel:', error);
    res.status(500).json({ message: 'Lỗi xuất Excel: ' + error.message });
  }
};


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

// Lấy cấu hình khung giờ nhận/sửa báo cáo & thời gian chiến dịch hiện tại
exports.getReportingConfig = async (req, res) => {
  try {
    const config = await getCampaignReportingConfig();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = parseTimeToMinutes(config.openTime, 13 * 60);
    const closeMinutes = parseTimeToMinutes(config.closeTime, 18 * 60 + 30);
    const editMinutes = parseTimeToMinutes(config.editDeadline || config.closeTime, 19 * 60);
    const isOpenNow = config.alwaysOpen || (currentMinutes >= openMinutes && currentMinutes <= closeMinutes);
    const canEditNow = config.alwaysOpen || (currentMinutes >= openMinutes && currentMinutes <= editMinutes);

    res.json({
      openTime: config.openTime || '13:00',
      closeTime: config.closeTime || '18:30',
      editDeadline: config.editDeadline || config.closeTime || '19:00',
      alwaysOpen: !!config.alwaysOpen,
      allowLateDate: config.allowLateDate || null,
      customNotice: config.customNotice || '',
      campaignStartDate: config.campaignStartDate || '2026-08-01',
      campaignEndDate: config.campaignEndDate || '2026-09-13',
      campaignTotalDays: config.campaignTotalDays || 44,
      campaignName: config.campaignName || 'Chiến dịch 44 ngày đêm — Đánh giá tiến độ 11 chỉ tiêu Chuyển đổi số',
      isOpenNow,
      canEditNow,
      updatedAt: config.updatedAt
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy cấu hình khung giờ: ' + err.message });
  }
};

// Cập nhật cấu hình khung giờ & thời gian chiến dịch (Dành cho Super Admin & Tỉnh)
exports.updateReportingConfig = async (req, res) => {
  try {
    if (req.user.role !== 'SENIOR_ADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'PROVINCE_ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa cấu hình hệ thống.' });
    }

    const { 
      openTime, closeTime, editDeadline, alwaysOpen, customNotice,
      campaignStartDate, campaignEndDate, campaignTotalDays, campaignName,
      allowLateDate
    } = req.body;
    
    // Validate format HH:mm
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (openTime && !timeRegex.test(openTime)) {
      return res.status(400).json({ message: 'Giờ mở cổng không đúng định dạng (HH:mm, ví dụ: 13:00)' });
    }
    if (closeTime && !timeRegex.test(closeTime)) {
      return res.status(400).json({ message: 'Giờ đóng cổng không đúng định dạng (HH:mm, ví dụ: 18:30)' });
    }
    if (editDeadline && !timeRegex.test(editDeadline)) {
      return res.status(400).json({ message: 'Hạn chỉnh sửa không đúng định dạng (HH:mm, ví dụ: 19:00)' });
    }

    // Tính tổng số ngày nếu có startDate và endDate
    let totalDays = Number(campaignTotalDays);
    if (campaignStartDate && campaignEndDate) {
      const s = new Date(campaignStartDate);
      const e = new Date(campaignEndDate);
      const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 0) totalDays = diffDays;
    }

    const updatePayload = {
      openTime: openTime || '13:00',
      closeTime: closeTime || '18:30',
      editDeadline: editDeadline || closeTime || '19:00',
      alwaysOpen: Boolean(alwaysOpen),
      allowLateDate: allowLateDate || null,  // null = tắt chế độ nộp muộn
      customNotice: customNotice || '',
      updatedBy: req.user.userId || req.user._id,
      updatedAt: Date.now()
    };

    if (campaignStartDate) updatePayload.campaignStartDate = campaignStartDate;
    if (campaignEndDate) updatePayload.campaignEndDate = campaignEndDate;
    if (totalDays) updatePayload.campaignTotalDays = totalDays;
    if (campaignName) updatePayload.campaignName = campaignName;

    const updated = await SystemConfig.findOneAndUpdate(
      { key: 'campaign_reporting' },
      updatePayload,
      { upsert: true, returnDocument: 'after' }
    );

    // Ghi log hoạt động
    await ActivityLog.create({
      user: req.user.userId || req.user._id,
      action: 'UPDATE_CONFIG',
      target: 'Cấu hình Khung giờ & Thời gian Chiến dịch',
      details: `Giờ mở: ${updated.openTime}, Giờ đóng: ${updated.closeTime}, Bắt đầu: ${updated.campaignStartDate}, Kết thúc: ${updated.campaignEndDate}, Tổng: ${updated.campaignTotalDays} ngày`
    });

    res.json({ message: 'Cập nhật cấu hình chiến dịch thành công!', config: updated });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi cập nhật cấu hình: ' + err.message });
  }
};
