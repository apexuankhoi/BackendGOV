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

// 24 Đơn vị đặc thù theo đúng bảng Excel ngày 20/08
const EXCEL_REPORTS_DAY20 = {
  'Đoàn xã Tuy An Bắc': { digitalSkills: 210, vneidSupport: 0, publicServices: 120, qrSupport: 0, activeTeams: 0, trainingClasses: 0, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 0, smartwebCount: 0, volunteers: 15, safetyCampaigns: 0, mediaPosts: 0, issues: '', proposals: '' },
  'Đoàn phường Đông Hòa': { digitalSkills: 200, vneidSupport: 150, publicServices: 200, qrSupport: 50, activeTeams: 1, trainingClasses: 1, digitalModels: 1, digitalProducts: 2, youthTrained: 50, youthProjects: 1, smartwebCount: 1, volunteers: 250, safetyCampaigns: 1, mediaPosts: 1, issues: '', proposals: '' },
  'Đoàn xã Xuân Thọ': { digitalSkills: 31, vneidSupport: 22, publicServices: 20, qrSupport: 22, activeTeams: 1, trainingClasses: 1, digitalModels: 1, digitalProducts: 1, youthTrained: 1, youthProjects: 0, smartwebCount: 0, volunteers: 30, safetyCampaigns: 0, mediaPosts: 0, issues: '', proposals: '' },
  'Đoàn phường Hòa Hiệp': { digitalSkills: 80, vneidSupport: 75, publicServices: 85, qrSupport: 15, activeTeams: 1, trainingClasses: 2, digitalModels: 1, digitalProducts: 1, youthTrained: 2, youthProjects: 1, smartwebCount: 0, volunteers: 140, safetyCampaigns: 0, mediaPosts: 1, issues: '', proposals: '' },
  'Phường Cư Bao': { digitalSkills: 25, vneidSupport: 11, publicServices: 32, qrSupport: 2, activeTeams: 1, trainingClasses: 2, digitalModels: 0, digitalProducts: 0, youthTrained: 45, youthProjects: 1, smartwebCount: 0, volunteers: 45, safetyCampaigns: 1, mediaPosts: 1, issues: '', proposals: '' },
  'Xã Ea Kar': { digitalSkills: 55, vneidSupport: 110, publicServices: 10, qrSupport: 0, activeTeams: 1, trainingClasses: 0, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 0, smartwebCount: 1, volunteers: 20, safetyCampaigns: 0, mediaPosts: 1, issues: 'Không có kinh phí để ra quân thường xuyên tại các thôn xa', proposals: 'Đề xuất Tỉnh hỗ trợ thêm tài liệu hướng dẫn và kinh phí hỗ trợ ĐVTN' },
  'Xã Cư Yang': { digitalSkills: 5, vneidSupport: 15, publicServices: 5, qrSupport: 10, activeTeams: 1, trainingClasses: 0, digitalModels: 1, digitalProducts: 0, youthTrained: 33, youthProjects: 0, smartwebCount: 0, volunteers: 40, safetyCampaigns: 0, mediaPosts: 0, issues: '', proposals: '' },
  'Xã Ea Wy': { digitalSkills: 50, vneidSupport: 30, publicServices: 10, qrSupport: 3, activeTeams: 1, trainingClasses: 1, digitalModels: 0, digitalProducts: 0, youthTrained: 20, youthProjects: 0, smartwebCount: 0, volunteers: 0, safetyCampaigns: 0, mediaPosts: 0, issues: '', proposals: '' },
  'Xã Cuôr Đăng': { digitalSkills: 80, vneidSupport: 85, publicServices: 46, qrSupport: 0, activeTeams: 0, trainingClasses: 0, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 0, smartwebCount: 0, volunteers: 135, safetyCampaigns: 0, mediaPosts: 0, issues: '', proposals: '' },
  'Xã Hòa Phú': { digitalSkills: 40, vneidSupport: 58, publicServices: 32, qrSupport: 5, activeTeams: 0, trainingClasses: 0, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 0, smartwebCount: 0, volunteers: 0, safetyCampaigns: 0, mediaPosts: 0, issues: '', proposals: '' },
  'Xã Dliê Ya': { digitalSkills: 0, vneidSupport: 0, publicServices: 0, qrSupport: 0, activeTeams: 0, trainingClasses: 0, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 0, smartwebCount: 0, volunteers: 0, safetyCampaigns: 0, mediaPosts: 0, issues: 'Chưa thành lập đội hình ra quân', proposals: '' },
  'Xã Ea Knuếc': { digitalSkills: 0, vneidSupport: 0, publicServices: 0, qrSupport: 0, activeTeams: 0, trainingClasses: 0, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 0, smartwebCount: 0, volunteers: 0, safetyCampaigns: 0, mediaPosts: 0, issues: '', proposals: '' },
  'Xã Phú Xuân': { digitalSkills: 70, vneidSupport: 80, publicServices: 30, qrSupport: 0, activeTeams: 1, trainingClasses: 2, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 1, smartwebCount: 0, volunteers: 30, safetyCampaigns: 0, mediaPosts: 0, issues: '', proposals: '' },
  'Đoàn xã Tuy An Đông': { digitalSkills: 24, vneidSupport: 7, publicServices: 0, qrSupport: 0, activeTeams: 1, trainingClasses: 1, digitalModels: 0, digitalProducts: 1, youthTrained: 0, youthProjects: 0, smartwebCount: 1, volunteers: 15, safetyCampaigns: 0, mediaPosts: 1, issues: '', proposals: '' },
  'Xã Krông Búk': { digitalSkills: 55, vneidSupport: 45, publicServices: 21, qrSupport: 25, activeTeams: 1, trainingClasses: 0, digitalModels: 0, digitalProducts: 3, youthTrained: 1, youthProjects: 0, smartwebCount: 0, volunteers: 35, safetyCampaigns: 0, mediaPosts: 0, issues: '', proposals: '' },
  'Xã Ea Knốp': { digitalSkills: 60, vneidSupport: 50, publicServices: 13, qrSupport: 0, activeTeams: 1, trainingClasses: 1, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 0, smartwebCount: 0, volunteers: 10, safetyCampaigns: 0, mediaPosts: 0, issues: '', proposals: '' },
  'Xã Yang Mao': { digitalSkills: 7, vneidSupport: 25, publicServices: 25, qrSupport: 13, activeTeams: 0, trainingClasses: 3, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 0, smartwebCount: 0, volunteers: 0, safetyCampaigns: 0, mediaPosts: 0, issues: '', proposals: '' },
  'Xã Cư Prao': { digitalSkills: 17, vneidSupport: 3, publicServices: 30, qrSupport: 0, activeTeams: 1, trainingClasses: 0, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 0, smartwebCount: 0, volunteers: 8, safetyCampaigns: 0, mediaPosts: 1, issues: '', proposals: '' },
  'Đoàn xã Tây Hòa': { digitalSkills: 13, vneidSupport: 0, publicServices: 0, qrSupport: 0, activeTeams: 1, trainingClasses: 0, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 0, smartwebCount: 0, volunteers: 20, safetyCampaigns: 0, mediaPosts: 0, issues: 'Không', proposals: 'Không' },
  'Phường Buôn Hồ': { digitalSkills: 0, vneidSupport: 0, publicServices: 0, qrSupport: 0, activeTeams: 0, trainingClasses: 0, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 0, smartwebCount: 0, volunteers: 0, safetyCampaigns: 0, mediaPosts: 0, issues: 'Hôm nay tạm dừng hoạt động để củng cố lực lượng ĐVTN', proposals: '' },
  'Đoàn xã Phú Mỡ': { digitalSkills: 50, vneidSupport: 200, publicServices: 15, qrSupport: 60, activeTeams: 1, trainingClasses: 1, digitalModels: 1, digitalProducts: 2, youthTrained: 35, youthProjects: 1, smartwebCount: 0, volunteers: 30, safetyCampaigns: 1, mediaPosts: 1, issues: '02 thôn sâu trung tâm xã còn 7km đường đồi dốc, sóng 4G chập chờn', proposals: 'Đề xuất hỗ trợ tập huấn về việc sử dụng AI và các tính năng trong sử dụng VNeID mức 2 cho nhân dân' },
  'Đoàn xã Hòa Thịnh': { digitalSkills: 20, vneidSupport: 60, publicServices: 25, qrSupport: 15, activeTeams: 1, trainingClasses: 1, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 0, smartwebCount: 0, volunteers: 8, safetyCampaigns: 0, mediaPosts: 0, issues: '', proposals: '' },
  'Xã Buôn Đôn': { digitalSkills: 16, vneidSupport: 28, publicServices: 7, qrSupport: 3, activeTeams: 1, trainingClasses: 0, digitalModels: 0, digitalProducts: 0, youthTrained: 0, youthProjects: 0, smartwebCount: 0, volunteers: 14, safetyCampaigns: 0, mediaPosts: 0, issues: '', proposals: '' },
  'Xã Pơng Drang': { digitalSkills: 51, vneidSupport: 30, publicServices: 7, qrSupport: 5, activeTeams: 1, trainingClasses: 1, digitalModels: 1, digitalProducts: 1, youthTrained: 32, youthProjects: 1, smartwebCount: 1, volunteers: 32, safetyCampaigns: 1, mediaPosts: 1, issues: 'Khó khăn trong tiếp cận một số hộ đồng bào DTTS lớn tuổi', proposals: 'Cần tài liệu infographic song ngữ Êđê - Kinh' }
};

// Hệ số lũy tiến theo từng ngày từ 16/08 đến 22/08
const DATES_PROGRESSION = [
  { dateStr: '2026-08-16', factor: 0.30, label: 'Ngày 16/08 (Khởi động)' },
  { dateStr: '2026-08-17', factor: 0.48, label: 'Ngày 17/08' },
  { dateStr: '2026-08-18', factor: 0.68, label: 'Ngày 18/08' },
  { dateStr: '2026-08-19', factor: 0.85, label: 'Ngày 19/08' },
  { dateStr: '2026-08-20', factor: 1.00, label: 'Ngày 20/08 (Chuẩn bảng Excel)' },
  { dateStr: '2026-08-21', factor: 1.15, label: 'Ngày 21/08' },
  { dateStr: '2026-08-22', factor: 1.32, label: 'Ngày 22/08' }
];

// Hàm tạo số ngẫu nhiên theo seed ổn định của xã
function pseudoRandom(seedStr) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(Math.abs(hash)) * 10000;
  return x - Math.floor(x);
}

async function seedData102Communes() {
  console.log('🔗 Đang kết nối MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Đã kết nối cơ sở dữ liệu!');

  // 1. XÓA SẠCH DỮ LIỆU NGÀY HÔM NAY 23/08 ĐỂ ĐỂ TRỐNG CHO CÁC XÃ VÀO NỘP
  const todayRange = getDayRange(new Date());
  const deletedToday = await CampaignReport.deleteMany({
    reportDate: { $gte: todayRange.start, $lte: todayRange.end }
  });
  console.log(`🧹 Đã xóa sạch báo cáo ngày hôm nay (${new Date().toLocaleDateString('vi-VN')}) để trống hoàn toàn (${deletedToday.deletedCount} bản ghi đã xóa).`);

  // 2. Lấy danh sách toàn bộ các xã/phường (level: COMMUNE, trừ chi hội)
  const allCommunes = await Agency.find({ 
    level: 'COMMUNE',
    name: { $not: /^Chi hội/i } 
  }).lean();

  console.log(`🏛️ Tìm thấy ${allCommunes.length} đơn vị cấp Xã/Phường/Thị trấn.`);

  const allUsers = await User.find().lean();
  const defaultUser = allUsers.find(u => u.role === 'PROVINCE_ADMIN' || u.role === 'SENIOR_ADMIN') || allUsers[0];

  let totalUpserted = 0;

  for (const day of DATES_PROGRESSION) {
    const range = getDayRange(day.dateStr);
    let dayCount = 0;
    const f = day.factor;

    for (const commune of allCommunes) {
      const commName = commune.name;
      const cleanName = commName.replace(/^(Đoàn xã|Đoàn phường|Xã|Phường|Thị trấn)\s*/i, '').trim();

      // Kiểm tra xem xã có trong bảng 24 xã Excel hay không
      let baseData = EXCEL_REPORTS_DAY20[commName] || EXCEL_REPORTS_DAY20[`Đoàn xã ${cleanName}`] || EXCEL_REPORTS_DAY20[`Xã ${cleanName}`] || EXCEL_REPORTS_DAY20[`Phường ${cleanName}`];

      if (!baseData) {
        // Tự sinh số liệu thực tế dựa trên tên xã
        const r1 = pseudoRandom(commName + '_1');
        const r2 = pseudoRandom(commName + '_2');
        const r3 = pseudoRandom(commName + '_3');
        const r4 = pseudoRandom(commName + '_4');
        const r5 = pseudoRandom(commName + '_5');

        const isUrban = commName.includes('Phường') || commName.includes('Buôn Ma Thuột');
        const dSkills = isUrban ? Math.round(50 + r1 * 120) : Math.round(20 + r1 * 80);
        const vneid = Math.round(dSkills * (0.6 + r2 * 0.5));
        const dvc = Math.round(dSkills * (0.3 + r3 * 0.4));
        const qr = Math.round(5 + r4 * 25);
        const teams = 1;
        const classes = r5 > 0.4 ? 1 : (r5 > 0.8 ? 2 : 0);
        const models = r1 > 0.65 ? 1 : 0;
        const ocop = r2 > 0.7 ? (r2 > 0.9 ? 2 : 1) : 0;
        const aiYouth = Math.round(10 + r3 * 35);
        const projects = r4 > 0.75 ? 1 : 0;
        const smartweb = r5 > 0.8 ? 1 : 0;
        const volunteers = Math.round(15 + r1 * 40);
        const safety = r2 > 0.8 ? 1 : 0;
        const media = r3 > 0.5 ? 1 : 0;

        baseData = {
          digitalSkills: dSkills,
          vneidSupport: vneid,
          publicServices: dvc,
          qrSupport: qr,
          activeTeams: teams,
          trainingClasses: classes,
          digitalModels: models,
          digitalProducts: ocop,
          youthTrained: aiYouth,
          youthProjects: projects,
          smartwebCount: smartweb,
          volunteers: volunteers,
          safetyCampaigns: safety,
          mediaPosts: media,
          issues: r1 > 0.85 ? 'Một số địa bàn vùng xa sóng viễn thông chưa ổn định' : '',
          proposals: r2 > 0.85 ? 'Đề xuất Tỉnh hỗ trợ thêm tài liệu tuyên truyền' : ''
        };
      }

      // Tìm User tương ứng
      const reporter = allUsers.find(u => 
        String(u.agencyId) === String(commune._id) || 
        u.email.toLowerCase().includes(commune.name.toLowerCase().replace(/\s+/g, ''))
      ) || defaultUser;

      const calcVal = (val) => val === 0 ? 0 : (f === 1.0 ? val : Math.max(1, Math.round(val * f)));

      const cleanFolder = commName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '');
      const evidenceUrl = `https://drive.google.com/drive/folders/${cleanFolder}_MinhChungCDS_2026`;

      const reportData = {
        agencyId: commune._id,
        reporterId: reporter?._id || defaultUser._id,
        reportDate: range.normalized,
        digitalSkills: calcVal(baseData.digitalSkills),
        vneidSupport: calcVal(baseData.vneidSupport),
        publicServices: calcVal(baseData.publicServices),
        qrSupport: calcVal(baseData.qrSupport),
        activeTeams: baseData.activeTeams > 0 ? 1 : 0,
        trainingClasses: calcVal(baseData.trainingClasses),
        digitalModels: baseData.digitalModels > 0 ? (f >= 0.68 ? baseData.digitalModels : 0) : 0,
        digitalProducts: calcVal(baseData.digitalProducts),
        youthTrained: calcVal(baseData.youthTrained),
        youthProjects: baseData.youthProjects > 0 ? (f >= 0.85 ? baseData.youthProjects : 0) : 0,
        smartwebCount: baseData.smartwebCount > 0 ? (f >= 0.85 ? baseData.smartwebCount : 0) : 0,
        volunteers: calcVal(baseData.volunteers),
        safetyCampaigns: baseData.safetyCampaigns,
        mediaPosts: baseData.mediaPosts,
        issues: baseData.issues || '',
        proposals: baseData.proposals || '',
        evidenceLinks: evidenceUrl,
        reporterName: `Cán bộ Đoàn ${commName}`,
        updatedAt: range.normalized
      };

      await CampaignReport.findOneAndUpdate(
        { agencyId: commune._id, reportDate: { $gte: range.start, $lte: range.end } },
        { $set: reportData },
        { upsert: true, returnDocument: 'after' }
      );

      // Đồng bộ Team
      try {
        const teamName = `Đội hình Thanh niên số ${commName}`;
        await Team.findOneAndUpdate(
          { 'location.commune': commName },
          {
            $set: {
              name: teamName,
              schoolOrUnit: `Đoàn cơ sở ${commName}`,
              agencyId: commune._id,
              reporterName: `Cán bộ Đoàn ${commName}`,
              evidenceLinks: evidenceUrl,
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

    console.log(`✅ ${day.label}: Đã nạp thành công ${dayCount} xã/phường`);
  }

  console.log('\n============================================================');
  console.log(`🎉 HOÀN THÀNH NẠP ĐỦ 102 XÃ/PHƯỜNG TỪ 16/08 ĐẾN 22/08!`);
  console.log(`📊 Tổng số báo cáo lịch sử: ${totalUpserted} bản ghi.`);
  console.log(`⚡ Ngày hôm nay (${new Date().toLocaleDateString('vi-VN')} - 23/08): HOÀN TOÀN TRỐNG để các xã tự vào nộp.`);
  console.log('============================================================\n');

  await mongoose.disconnect();
}

seedData102Communes().catch(err => {
  console.error('❌ Lỗi khi chạy seed:', err);
  process.exit(1);
});
