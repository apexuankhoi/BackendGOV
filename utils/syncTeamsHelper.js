const CampaignReport = require('../models/CampaignReport');
const Team = require('../models/Team');
const Agency = require('../models/Agency');
const User = require('../models/User');

function getDistrictFromCommune(communeName) {
  if (!communeName) return 'TP Buôn Ma Thuột';
  if (communeName.includes('Buôn Ma Thuột') || communeName.includes('Tân An') || communeName.includes('Tân Lập') || communeName.includes('Thành Nhất') || communeName.includes('Ea Kao') || communeName.includes('Hòa Phú')) {
    return 'TP Buôn Ma Thuột';
  } else if (communeName.includes('Buôn Hồ') || communeName.includes('Cư Bao') || communeName.includes('Ea Drông')) {
    return 'TX Buôn Hồ';
  } else if (communeName.includes('Ea Súp') || communeName.includes('Ea Rốk') || communeName.includes('Ea Bung') || communeName.includes('Ia Rvê') || communeName.includes('Ia Lốp')) {
    return 'Huyện Ea Súp';
  } else if (communeName.includes('Ea Wer') || communeName.includes('Ea Nuôl') || communeName.includes('Buôn Đôn')) {
    return 'Huyện Buôn Đôn';
  } else if (communeName.includes('Ea Kiết') || communeName.includes('Ea M\'Droh') || communeName.includes('Quảng Phú') || communeName.includes('Cuôr Đăng') || communeName.includes('Cư M\'gar') || communeName.includes('Ea Tul')) {
    return 'Huyện Cư M\'gar';
  } else if (communeName.includes('Pơng Drang') || communeName.includes('Krông Búk') || communeName.includes('Cư Pơng')) {
    return 'Huyện Krông Búk';
  } else if (communeName.includes('Ea Khal') || communeName.includes('Ea Drăng') || communeName.includes('Ea Wy') || communeName.includes('Ea H\'Leo') || communeName.includes('Ea Hiao')) {
    return "Huyện Ea H'leo";
  } else if (communeName.includes('Krông Năng') || communeName.includes('Dliê Ya') || communeName.includes('Tam Giang') || communeName.includes('Phú Xuân')) {
    return 'Huyện Krông Năng';
  } else if (communeName.includes('Krông Pắc') || communeName.includes('Ea Knuếc') || communeName.includes('Tân Tiến') || communeName.includes('Ea Phê') || communeName.includes('Ea Kly') || communeName.includes('Vụ Bổn')) {
    return 'Huyện Krông Pắc';
  } else if (communeName.includes('Ea Kar') || communeName.includes('Ea Ô') || communeName.includes('Ea Knốp') || communeName.includes('Cư Yang') || communeName.includes('Ea Păl')) {
    return 'Huyện Ea Kar';
  } else if (communeName.includes('M\'Drắk') || communeName.includes('Ea Riêng') || communeName.includes('Cư M\'ta') || communeName.includes('Krông Á') || communeName.includes('Cư Prao') || communeName.includes('Ea Trang')) {
    return "Huyện M'Đrắk";
  } else if (communeName.includes('Hòa Sơn') || communeName.includes('Dang Kang') || communeName.includes('Krông Bông') || communeName.includes('Yang Mao') || communeName.includes('Cư Pui')) {
    return 'Huyện Krông Bông';
  } else if (communeName.includes('Liên Sơn') || communeName.includes('Đắk Liêng') || communeName.includes('Nam Ka') || communeName.includes('Đắk Phơi')) {
    return 'Huyện Lắk';
  } else if (communeName.includes('Krông Nô') || communeName.includes('Ea Ning') || communeName.includes('Dray Bhăng') || communeName.includes('Ea Ktur') || communeName.includes('Krông Ana') || communeName.includes('Dur Kmăl') || communeName.includes('Ea Na')) {
    return 'Huyện Krông Ana';
  }
  return 'TP Buôn Ma Thuột';
}

async function syncAllTeamsFromReports() {
  try {
    // Lấy toàn bộ các báo cáo chiến dịch đã nộp
    const reportAgg = await CampaignReport.aggregate([
      {
        $group: {
          _id: '$agencyId',
          totalVolunteers: { $sum: '$volunteers' },
          totalProjects: { $sum: '$youthProjects' },
          totalDigitalSkills: { $sum: '$digitalSkills' },
          totalVneid: { $sum: '$vneidSupport' },
          totalPublicServices: { $sum: '$publicServices' },
          lastReporterId: { $last: '$reporterId' },
          activeTeamsCount: { $sum: '$activeTeams' }
        }
      }
    ]);

    let defaultUser = await User.findOne({ role: { $in: ['SENIOR_ADMIN', 'ADMIN', 'PROVINCE_ADMIN'] } });
    const defaultUserId = defaultUser ? defaultUser._id : null;

    let syncedCount = 0;

    for (const item of reportAgg) {
      if (!item._id) continue;
      const agency = await Agency.findById(item._id);
      if (!agency) continue;

      const communeName = agency.name;
      const districtName = getDistrictFromCommune(communeName);
      const teamName = `Đội hình Thanh niên số ${communeName}`;
      const totalBeneficiaries = (item.totalDigitalSkills || 0) + (item.totalVneid || 0) + (item.totalPublicServices || 0);
      const volunteersCount = item.totalVolunteers > 0 ? item.totalVolunteers : 15;
      const projectsCount = item.totalProjects > 0 ? item.totalProjects : 1;
      const estimatedValue = Math.round(((item.totalPublicServices || 0) * 0.05 + (item.totalDigitalSkills || 0) * 0.02) * 10) / 10 || 5;

      await Team.findOneAndUpdate(
        { 'location.commune': communeName },
        {
          name: teamName,
          schoolOrUnit: `Đoàn cơ sở ${communeName}`,
          createdBy: item.lastReporterId || defaultUserId,
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
            startDate: new Date('2026-07-01'),
            endDate: new Date('2026-08-31')
          },
          statistics: {
            volunteersCount,
            projectsCount,
            estimatedValue,
            beneficiaries: totalBeneficiaries || 50
          },
          status: 'APPROVED'
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      syncedCount++;
    }

    console.log(`✅ Đã đồng bộ thành công ${syncedCount} Đội hình Thanh niên số từ các báo cáo đã nộp.`);
    return { success: true, syncedCount };
  } catch (err) {
    console.error('Error in syncAllTeamsFromReports:', err);
    return { success: false, error: err.message };
  }
}

module.exports = { syncAllTeamsFromReports, getDistrictFromCommune };
