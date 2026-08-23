require('dotenv').config();
const mongoose = require('mongoose');
const Agency = require('./models/Agency');
const User = require('./models/User');
const CampaignReport = require('./models/CampaignReport');
const Team = require('./models/Team');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/webgov_daklak';

function getDayRange(dateInput) {
  let targetDate;
  if (!dateInput) {
    targetDate = new Date();
  } else if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, d] = dateInput.split('-').map(Number);
    targetDate = new Date(y, m - 1, d, 12, 0, 0);
  } else {
    targetDate = new Date(dateInput);
  }
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);
  const normalized = new Date(start);
  return { start, end, normalized };
}

// 24 Đơn vị theo đúng bảng số liệu ngày 20/08/2026 từ hình ảnh
const BASE_REPORTS_DAY20 = [
  {
    agencyName: 'Đoàn xã Tuy An Bắc',
    reporterName: 'Đoàn xã Tuy An Bắc',
    digitalSkills: 210, vneidSupport: 0, publicServices: 120, qrSupport: 0,
    activeTeams: 0, trainingClasses: 0, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 0, smartwebCount: 0,
    volunteers: 15, safetyCampaigns: 0, mediaPosts: 0,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/TuyAnBac_MinhChungCDS'
  },
  {
    agencyName: 'Đoàn phường Đông Hòa',
    reporterName: 'Đoàn phường Đông Hòa',
    digitalSkills: 200, vneidSupport: 150, publicServices: 200, qrSupport: 50,
    activeTeams: 1, trainingClasses: 1, digitalModels: 1, digitalProducts: 2,
    youthTrained: 50, youthProjects: 1, smartwebCount: 1,
    volunteers: 250, safetyCampaigns: 1, mediaPosts: 1,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/DongHoa_MinhChungCDS'
  },
  {
    agencyName: 'Đoàn xã Xuân Thọ',
    reporterName: 'Đoàn xã Xuân Thọ',
    digitalSkills: 31, vneidSupport: 22, publicServices: 20, qrSupport: 22,
    activeTeams: 1, trainingClasses: 1, digitalModels: 1, digitalProducts: 1,
    youthTrained: 1, youthProjects: 0, smartwebCount: 0,
    volunteers: 30, safetyCampaigns: 0, mediaPosts: 0,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/XuanTho_MinhChungCDS'
  },
  {
    agencyName: 'Đoàn phường Hòa Hiệp',
    reporterName: 'Đoàn phường Hòa Hiệp',
    digitalSkills: 80, vneidSupport: 75, publicServices: 85, qrSupport: 15,
    activeTeams: 1, trainingClasses: 2, digitalModels: 1, digitalProducts: 1,
    youthTrained: 2, youthProjects: 1, smartwebCount: 0,
    volunteers: 140, safetyCampaigns: 0, mediaPosts: 1,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/HoaHiep_MinhChungCDS'
  },
  {
    agencyName: 'Phường Cư Bao',
    reporterName: 'Phường Cư Bao',
    digitalSkills: 25, vneidSupport: 11, publicServices: 32, qrSupport: 2,
    activeTeams: 1, trainingClasses: 2, digitalModels: 0, digitalProducts: 0,
    youthTrained: 45, youthProjects: 1, smartwebCount: 0,
    volunteers: 45, safetyCampaigns: 1, mediaPosts: 1,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/CuBao_MinhChungCDS'
  },
  {
    agencyName: 'Xã Ea Kar',
    reporterName: 'Xã Ea Kar',
    digitalSkills: 55, vneidSupport: 110, publicServices: 10, qrSupport: 0,
    activeTeams: 1, trainingClasses: 0, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 0, smartwebCount: 1,
    volunteers: 20, safetyCampaigns: 0, mediaPosts: 1,
    issues: 'Không có kinh phí để ra quân thường xuyên tại các thôn xa',
    proposals: 'Đề xuất Tỉnh hỗ trợ thêm tài liệu hướng dẫn và kinh phí hỗ trợ ĐVTN',
    evidenceLinks: 'https://drive.google.com/drive/folders/EaKar_MinhChungCDS'
  },
  {
    agencyName: 'Xã Cư Yang',
    reporterName: 'Xã Cư Yang',
    digitalSkills: 5, vneidSupport: 15, publicServices: 5, qrSupport: 10,
    activeTeams: 1, trainingClasses: 0, digitalModels: 1, digitalProducts: 0,
    youthTrained: 33, youthProjects: 0, smartwebCount: 0,
    volunteers: 40, safetyCampaigns: 0, mediaPosts: 0,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/CuYang_MinhChungCDS'
  },
  {
    agencyName: 'Xã Ea Wy',
    reporterName: 'Xã Ea Wy',
    digitalSkills: 50, vneidSupport: 30, publicServices: 10, qrSupport: 3,
    activeTeams: 1, trainingClasses: 1, digitalModels: 0, digitalProducts: 0,
    youthTrained: 20, youthProjects: 0, smartwebCount: 0,
    volunteers: 0, safetyCampaigns: 0, mediaPosts: 0,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/EaWy_MinhChungCDS'
  },
  {
    agencyName: 'Xã Cuôr Đăng',
    reporterName: 'Xã Cuôr Đăng',
    digitalSkills: 80, vneidSupport: 85, publicServices: 46, qrSupport: 0,
    activeTeams: 0, trainingClasses: 0, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 0, smartwebCount: 0,
    volunteers: 135, safetyCampaigns: 0, mediaPosts: 0,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/CuorDang_MinhChungCDS'
  },
  {
    agencyName: 'Xã Hòa Phú',
    reporterName: 'Xã Hòa Phú',
    digitalSkills: 40, vneidSupport: 58, publicServices: 32, qrSupport: 5,
    activeTeams: 0, trainingClasses: 0, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 0, smartwebCount: 0,
    volunteers: 0, safetyCampaigns: 0, mediaPosts: 0,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/HoaPhu_MinhChungCDS'
  },
  {
    agencyName: 'Xã Dliê Ya',
    reporterName: 'Xã Dliê Ya',
    digitalSkills: 0, vneidSupport: 0, publicServices: 0, qrSupport: 0,
    activeTeams: 0, trainingClasses: 0, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 0, smartwebCount: 0,
    volunteers: 0, safetyCampaigns: 0, mediaPosts: 0,
    issues: 'Chưa thành lập đội hình ra quân', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/DlieYa_MinhChungCDS'
  },
  {
    agencyName: 'Xã Ea Knuếc',
    reporterName: 'Xã Ea Knuếc',
    digitalSkills: 0, vneidSupport: 0, publicServices: 0, qrSupport: 0,
    activeTeams: 0, trainingClasses: 0, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 0, smartwebCount: 0,
    volunteers: 0, safetyCampaigns: 0, mediaPosts: 0,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/EaKnuec_MinhChungCDS'
  },
  {
    agencyName: 'Xã Phú Xuân',
    reporterName: 'Xã Phú Xuân',
    digitalSkills: 70, vneidSupport: 80, publicServices: 30, qrSupport: 0,
    activeTeams: 1, trainingClasses: 2, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 1, smartwebCount: 0,
    volunteers: 30, safetyCampaigns: 0, mediaPosts: 0,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/PhuXuan_MinhChungCDS'
  },
  {
    agencyName: 'Đoàn xã Tuy An Đông',
    reporterName: 'Đoàn xã Tuy An Đông',
    digitalSkills: 24, vneidSupport: 7, publicServices: 0, qrSupport: 0,
    activeTeams: 1, trainingClasses: 1, digitalModels: 0, digitalProducts: 1,
    youthTrained: 0, youthProjects: 0, smartwebCount: 1,
    volunteers: 15, safetyCampaigns: 0, mediaPosts: 1,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/TuyAnDong_MinhChungCDS'
  },
  {
    agencyName: 'Xã Krông Búk',
    reporterName: 'Xã Krông Búk',
    digitalSkills: 55, vneidSupport: 45, publicServices: 21, qrSupport: 25,
    activeTeams: 1, trainingClasses: 0, digitalModels: 0, digitalProducts: 3,
    youthTrained: 1, youthProjects: 0, smartwebCount: 0,
    volunteers: 35, safetyCampaigns: 0, mediaPosts: 0,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/KrongBuk_MinhChungCDS'
  },
  {
    agencyName: 'Xã Ea Knốp',
    reporterName: 'Xã Ea Knốp',
    digitalSkills: 60, vneidSupport: 50, publicServices: 13, qrSupport: 0,
    activeTeams: 1, trainingClasses: 1, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 0, smartwebCount: 0,
    volunteers: 10, safetyCampaigns: 0, mediaPosts: 0,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/EaKnop_MinhChungCDS'
  },
  {
    agencyName: 'Xã Yang Mao',
    reporterName: 'Xã Yang Mao',
    digitalSkills: 7, vneidSupport: 25, publicServices: 25, qrSupport: 13,
    activeTeams: 0, trainingClasses: 3, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 0, smartwebCount: 0,
    volunteers: 0, safetyCampaigns: 0, mediaPosts: 0,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/YangMao_MinhChungCDS'
  },
  {
    agencyName: 'Xã Cư Prao',
    reporterName: 'Xã Cư Prao',
    digitalSkills: 17, vneidSupport: 3, publicServices: 30, qrSupport: 0,
    activeTeams: 1, trainingClasses: 0, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 0, smartwebCount: 0,
    volunteers: 8, safetyCampaigns: 0, mediaPosts: 1,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/CuPrao_MinhChungCDS'
  },
  {
    agencyName: 'Đoàn xã Tây Hòa',
    reporterName: 'Đoàn xã Tây Hòa',
    digitalSkills: 13, vneidSupport: 0, publicServices: 0, qrSupport: 0,
    activeTeams: 1, trainingClasses: 0, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 0, smartwebCount: 0,
    volunteers: 20, safetyCampaigns: 0, mediaPosts: 0,
    issues: 'Không', proposals: 'Không',
    evidenceLinks: 'https://drive.google.com/drive/folders/TayHoa_MinhChungCDS'
  },
  {
    agencyName: 'Phường Buôn Hồ',
    reporterName: 'Phường Buôn Hồ',
    digitalSkills: 0, vneidSupport: 0, publicServices: 0, qrSupport: 0,
    activeTeams: 0, trainingClasses: 0, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 0, smartwebCount: 0,
    volunteers: 0, safetyCampaigns: 0, mediaPosts: 0,
    issues: 'Hôm nay tạm dừng hoạt động để củng cố lực lượng ĐVTN', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/BuonHo_MinhChungCDS'
  },
  {
    agencyName: 'Đoàn xã Phú Mỡ',
    reporterName: 'Đoàn xã Phú Mỡ',
    digitalSkills: 50, vneidSupport: 200, publicServices: 15, qrSupport: 60,
    activeTeams: 1, trainingClasses: 1, digitalModels: 1, digitalProducts: 2,
    youthTrained: 35, youthProjects: 1, smartwebCount: 0,
    volunteers: 30, safetyCampaigns: 1, mediaPosts: 1,
    issues: '02 thôn sâu trung tâm xã còn 7km đường đồi dốc, sóng 4G chập chờn',
    proposals: 'Đề xuất hỗ trợ tập huấn về việc sử dụng AI và các tính năng trong sử dụng VNeID mức 2 cho nhân dân',
    evidenceLinks: 'https://drive.google.com/drive/folders/PhuMo_MinhChungCDS'
  },
  {
    agencyName: 'Đoàn xã Hòa Thịnh',
    reporterName: 'Đoàn xã Hòa Thịnh',
    digitalSkills: 20, vneidSupport: 60, publicServices: 25, qrSupport: 15,
    activeTeams: 1, trainingClasses: 1, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 0, smartwebCount: 0,
    volunteers: 8, safetyCampaigns: 0, mediaPosts: 0,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/HoaThinh_MinhChungCDS'
  },
  {
    agencyName: 'Xã Buôn Đôn',
    reporterName: 'Xã Buôn Đôn',
    digitalSkills: 16, vneidSupport: 28, publicServices: 7, qrSupport: 3,
    activeTeams: 1, trainingClasses: 0, digitalModels: 0, digitalProducts: 0,
    youthTrained: 0, youthProjects: 0, smartwebCount: 0,
    volunteers: 14, safetyCampaigns: 0, mediaPosts: 0,
    issues: '', proposals: '',
    evidenceLinks: 'https://drive.google.com/drive/folders/BuonDon_MinhChungCDS'
  },
  {
    agencyName: 'Xã Pơng Drang',
    reporterName: 'Xã Pơng Drang',
    digitalSkills: 51, vneidSupport: 30, publicServices: 7, qrSupport: 5,
    activeTeams: 1, trainingClasses: 1, digitalModels: 1, digitalProducts: 1,
    youthTrained: 32, youthProjects: 1, smartwebCount: 1,
    volunteers: 32, safetyCampaigns: 1, mediaPosts: 1,
    issues: 'Khó khăn trong tiếp cận một số hộ đồng bào DTTS lớn tuổi',
    proposals: 'Cần tài liệu infographic song ngữ Êđê - Kinh',
    evidenceLinks: 'https://drive.google.com/drive/folders/PongDrang_MinhChungCDS'
  }
];

// CHỈ TẠO LỊCH SỬ TỪ 16/08 ĐẾN 22/08 (BỎ NGÀY HÔM NAY 23/08 ĐỂ TRẮNG ĐỂ CÁC XÃ VÀO NỘP)
const DATES_PROGRESSION = [
  { dateStr: '2026-08-16', factor: 0.30, label: 'Ngày 16/08 (Khởi động)' },
  { dateStr: '2026-08-17', factor: 0.48, label: 'Ngày 17/08' },
  { dateStr: '2026-08-18', factor: 0.68, label: 'Ngày 18/08' },
  { dateStr: '2026-08-19', factor: 0.85, label: 'Ngày 19/08' },
  { dateStr: '2026-08-20', factor: 1.00, label: 'Ngày 20/08 (Chuẩn bảng Excel)' },
  { dateStr: '2026-08-21', factor: 1.15, label: 'Ngày 21/08' },
  { dateStr: '2026-08-22', factor: 1.32, label: 'Ngày 22/08' }
];

async function seedDataProgressive() {
  console.log('🔗 Đang kết nối MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Đã kết nối cơ sở dữ liệu!');

  // 1. Xóa sạch các báo cáo của ngày hôm nay 23/08 (nếu có) để hôm nay trống trơn
  const todayRange = getDayRange(new Date());
  const deletedToday = await CampaignReport.deleteMany({
    reportDate: { $gte: todayRange.start, $lte: todayRange.end }
  });
  console.log(`🧹 Đã dọn sạch báo cáo ngày hôm nay (${new Date().toLocaleDateString('vi-VN')}) để trống cho các xã tự nộp. Số lượng đã xóa: ${deletedToday.deletedCount}`);

  // 2. Nạp dữ liệu các ngày từ 16 đến 22
  const allAgencies = await Agency.find().lean();
  const allUsers = await User.find().lean();

  const agencyMap = {};
  allAgencies.forEach(a => {
    agencyMap[a.name] = a;
    const clean = a.name.replace(/^(Đoàn xã|Đoàn phường|Xã|Phường|Thị trấn)\s*/i, '').trim();
    if (!agencyMap[clean]) agencyMap[clean] = a;
  });

  const defaultUser = allUsers.find(u => u.role === 'PROVINCE_ADMIN' || u.role === 'SENIOR_ADMIN') || allUsers[0];

  let totalUpserted = 0;

  for (const day of DATES_PROGRESSION) {
    const range = getDayRange(day.dateStr);
    let dayCount = 0;

    for (const item of BASE_REPORTS_DAY20) {
      let agency = agencyMap[item.agencyName];
      if (!agency) {
        const cleanName = item.agencyName.replace(/^(Đoàn xã|Đoàn phường|Xã|Phường|Thị trấn)\s*/i, '').trim();
        agency = agencyMap[cleanName];
      }
      if (!agency) {
        agency = allAgencies.find(a => a.name.includes(item.agencyName) || item.agencyName.includes(a.name));
      }

      if (!agency) {
        agency = await Agency.create({
          name: item.agencyName,
          level: 'COMMUNE',
          description: `Cấp Xã/Phường - ${item.agencyName}`
        });
        agencyMap[item.agencyName] = agency;
      }

      const reporter = allUsers.find(u => 
        String(u.agencyId) === String(agency._id) || 
        u.username === item.reporterName || 
        u.email.toLowerCase().includes(agency.name.toLowerCase().replace(/\s+/g, ''))
      ) || defaultUser;

      const f = day.factor;
      const calcVal = (val) => val === 0 ? 0 : (f === 1.0 ? val : Math.max(1, Math.round(val * f)));

      const reportData = {
        agencyId: agency._id,
        reporterId: reporter?._id || defaultUser._id,
        reportDate: range.normalized,
        digitalSkills: calcVal(item.digitalSkills),
        vneidSupport: calcVal(item.vneidSupport),
        publicServices: calcVal(item.publicServices),
        qrSupport: calcVal(item.qrSupport),
        activeTeams: item.activeTeams > 0 ? 1 : 0,
        trainingClasses: calcVal(item.trainingClasses),
        digitalModels: item.digitalModels > 0 ? (f >= 0.68 ? item.digitalModels : 0) : 0,
        digitalProducts: calcVal(item.digitalProducts),
        youthTrained: calcVal(item.youthTrained),
        youthProjects: item.youthProjects > 0 ? (f >= 0.85 ? item.youthProjects : 0) : 0,
        smartwebCount: item.smartwebCount > 0 ? (f >= 0.85 ? item.smartwebCount : 0) : 0,
        volunteers: calcVal(item.volunteers),
        safetyCampaigns: item.safetyCampaigns,
        mediaPosts: item.mediaPosts,
        issues: item.issues || '',
        proposals: item.proposals || '',
        evidenceLinks: item.evidenceLinks,
        reporterName: item.reporterName,
        updatedAt: range.normalized
      };

      await CampaignReport.findOneAndUpdate(
        { agencyId: agency._id, reportDate: { $gte: range.start, $lte: range.end } },
        { $set: reportData },
        { upsert: true, returnDocument: 'after' }
      );

      // Đồng bộ Team
      try {
        const teamName = `Đội hình Thanh niên số ${agency.name}`;
        await Team.findOneAndUpdate(
          { 'location.commune': agency.name },
          {
            $set: {
              name: teamName,
              schoolOrUnit: `Đoàn cơ sở ${agency.name}`,
              agencyId: agency._id,
              reporterName: item.reporterName,
              evidenceLinks: item.evidenceLinks,
              kpiSummary: {
                digitalSkills: reportData.digitalSkills,
                vneidSupport: reportData.vneidSupport,
                publicServices: reportData.publicServices,
                qrSupport: reportData.qrSupport,
                smartwebCount: reportData.smartwebCount
              },
              statistics: {
                volunteersCount: reportData.volunteers || 15,
                projectsCount: reportData.youthProjects || 1,
                beneficiaries: reportData.digitalSkills + reportData.vneidSupport + reportData.publicServices
              },
              status: 'APPROVED',
              updatedAt: range.normalized
            }
          },
          { upsert: true }
        );
      } catch {}

      dayCount++;
      totalUpserted++;
    }

    console.log(`✅ ${day.label}: Đã nạp thành công ${dayCount} báo cáo`);
  }

  console.log('\n============================================================');
  console.log(`🎉 HOÀN THÀNH! Đã nạp lịch sử từ 16/08 đến 22/08 (${totalUpserted} bản ghi).`);
  console.log(`⚡ Ngày hôm nay (${new Date().toLocaleDateString('vi-VN')}) ĐÃ ĐƯỢC ĐỂ TRỐNG để các xã nộp thực tế.`);
  console.log('============================================================\n');

  await mongoose.disconnect();
}

seedDataProgressive().catch(err => {
  console.error('❌ Lỗi khi chạy seed:', err);
  process.exit(1);
});
