require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Agency = require('./models/Agency');
const Team = require('./models/Team');
const News = require('./models/News');
const CampaignReport = require('./models/CampaignReport');
const SmartwebRegistration = require('./models/SmartwebRegistration');
const SupportRequest = require('./models/SupportRequest');
const Document = require('./models/Document');
const Task = require('./models/Task');
const SharedFile = require('./models/SharedFile');
const ActivityLog = require('./models/ActivityLog');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/webgov_daklak';

// Danh sách 102 Xã/Phường/Thị trấn thuộc Tỉnh Đắk Lắk
const COMMUNES_LIST = [
  "Phường Buôn Ma Thuột", "Phường Tân An", "Phường Tân Lập", "Phường Thành Nhất", "Phường Ea Kao", "Xã Hòa Phú",
  "Phường Buôn Hồ", "Phường Cư Bao", "Xã Ea Drông",
  "Xã Ea Súp", "Xã Ea Rốk", "Xã Ea Bung", "Xã Ia Rvê", "Xã Ia Lốp", "Xã Ea Wer", "Xã Ea Nuôl", "Xã Buôn Đôn",
  "Xã Ea Kiết", "Xã Ea M'Droh", "Xã Quảng Phú", "Xã Cuôr Đăng", "Xã Cư M'gar", "Xã Ea Tul",
  "Xã Pơng Drang", "Xã Krông Búk", "Xã Cư Pơng",
  "Xã Ea Khal", "Xã Ea Drăng", "Xã Ea Wy", "Xã Ea H'Leo", "Xã Ea Hiao",
  "Xã Krông Năng", "Xã Dliê Ya", "Xã Tam Giang", "Xã Phú Xuân",
  "Xã Krông Pắc", "Xã Ea Knuếc", "Xã Tân Tiến", "Xã Ea Phê", "Xã Ea Kly", "Xã Vụ Bổn",
  "Xã Ea Kar", "Xã Ea Ô", "Xã Ea Knốp", "Xã Cư Yang", "Xã Ea Păl",
  "Xã M'Drắk", "Xã Ea Riêng", "Xã Cư M'ta", "Xã Krông Á", "Xã Cư Prao", "Xã Ea Trang",
  "Xã Hòa Sơn", "Xã Dang Kang", "Xã Krông Bông", "Xã Yang Mao", "Xã Cư Pui",
  "Xã Liên Sơn Lắk", "Xã Đắk Liêng", "Xã Nam Ka", "Xã Đắk Phơi",
  "Xã Krông Nô", "Xã Ea Ning", "Xã Dray Bhăng", "Xã Ea Ktur", "Xã Krông Ana", "Xã Dur Kmăl", "Xã Ea Na",
  "Đoàn phường Tuy Hòa", "Đoàn phường Phú Yên", "Đoàn phường Bình Kiến", "Đoàn phường Xuân Đài", "Đoàn phường Sông Cầu",
  "Đoàn xã Xuân Thọ", "Đoàn xã Xuân Cảnh", "Đoàn xã Xuân Lộc",
  "Đoàn phường Đông Hòa", "Đoàn phường Hòa Hiệp", "Đoàn xã Hòa Xuân",
  "Đoàn xã Tuy An Bắc", "Đoàn xã Tuy An Đông", "Đoàn xã Ô Loan", "Đoàn xã Tuy An Nam", "Đoàn xã Tuy An Tây",
  "Đoàn xã Phú Hòa 1", "Đoàn xã Phú Hòa 2", "Đoàn xã Hòa Thịnh", "Đoàn xã Hòa Mỹ",
  "Đoàn xã Tây Hòa", "Đoàn xã Sơn Thành", "Đoàn xã Sơn Hòa", "Đoàn xã Vân Hòa", "Đoàn xã Tây Sơn", "Đoàn xã Suối Trai",
  "Đoàn xã Ea Ly", "Đoàn xã Ea Bá", "Đoàn xã Đức Bình", "Đoàn xã Sông Hinh",
  "Đoàn xã Xuân Lãnh", "Đoàn xã Phú Mỡ", "Đoàn xã Xuân Phước", "Đoàn xã Đồng Xuân"
];

// Hàm chuyển đổi tên xã sang email dạng Eakar@gmail.com
function removeVietnameseTones(str) {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  str = str.replace(/Đ/g, 'D');
  return str;
}

function generateCommuneEmail(name) {
  let cleanName = name
    .replace(/^Đoàn phường\s+/i, '')
    .replace(/^Đoàn xã\s+/i, '')
    .replace(/^Phường\s+/i, '')
    .replace(/^Xã\s+/i, '')
    .replace(/^Thị trấn\s+/i, '');

  let noTone = removeVietnameseTones(cleanName);
  let slug = noTone.replace(/[^a-zA-Z0-9]/g, '');
  let formatted = slug.charAt(0).toUpperCase() + slug.slice(1).toLowerCase();
  return `${formatted}@gmail.com`;
}

// Random helper trong khoảng [min, max]
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔗 Đã kết nối cơ sở dữ liệu MongoDB:', MONGODB_URI);

    // ── 0. Xóa sạch dữ liệu cũ ──────────────────────────────────────────
    await Promise.all([
      User.deleteMany({}),
      Agency.deleteMany({}),
      Team.deleteMany({}),
      News.deleteMany({}),
      CampaignReport.deleteMany({}),
      SmartwebRegistration.deleteMany({}),
      SupportRequest.deleteMany({}),
      Document.deleteMany({}),
      Task.deleteMany({}),
      SharedFile.deleteMany({}),
      ActivityLog.deleteMany({})
    ]);
    console.log('🧹 Đã xóa sạch dữ liệu cũ');

    const pwDefault = await bcrypt.hash('Password123!', 10);
    const pwAdmin = await bcrypt.hash('123456', 10);

    // ── 1. Tạo Cơ quan cấp Tỉnh & Phân cấp Đoàn - Hội ────────────────────
    const provinceAgency = await Agency.create({
      name: 'Tỉnh Đắk Lắk',
      level: 'PROVINCE',
      description: 'UBND và Hội Sinh viên VN Tỉnh Đắk Lắk'
    });

    const hsvProvinceAgency = await Agency.create({
      name: 'HSV VN Tỉnh Đắk Lắk',
      level: 'PROVINCE',
      parentAgency: provinceAgency._id,
      description: 'Hội Sinh viên Việt Nam Tỉnh Đắk Lắk'
    });

    const schoolAgency = await Agency.create({
      name: 'HSV Trường ĐHTN',
      level: 'MINISTRY',
      parentAgency: hsvProvinceAgency._id,
      description: 'Hội Sinh viên Trường Đại học Tây Nguyên'
    });

    const lchAgency = await Agency.create({
      name: 'LCH Khoa KHTN và CN',
      level: 'DISTRICT',
      parentAgency: schoolAgency._id,
      description: 'Liên chi hội Khoa Khoa học Tự nhiên & Công nghệ'
    });

    const chAgency = await Agency.create({
      name: 'Chi hội SP Vật lí K23',
      level: 'COMMUNE',
      parentAgency: lchAgency._id,
      description: 'Chi hội Sư phạm Vật lí K23 - ĐHTN'
    });

    // ── 2. Tạo 102 Cơ quan cấp Xã/Phường ──────────────────────────────────
    const communeAgencyDocs = COMMUNES_LIST.map((communeName) => ({
      name: communeName,
      level: 'COMMUNE',
      parentAgency: provinceAgency._id,
      description: `Cấp Xã/Phường - ${communeName}`
    }));

    const insertedAgencies = await Agency.insertMany(communeAgencyDocs);
    console.log(`🏘 Đã tạo ${insertedAgencies.length} Cơ quan cấp Xã/Phường`);

    const agencyMap = {};
    insertedAgencies.forEach((ag) => { agencyMap[ag.name] = ag._id; });

    // ── 3. Tạo các Tài khoản Quản trị & Mẫu theo phân cấp ────────────────
    const seniorAdmin = await User.create({
      username: 'Super Admin Hệ thống',
      email: 'admin@daklak.gov.vn',
      password: pwAdmin, // 123456
      role: 'SENIOR_ADMIN',
      agencyId: provinceAgency._id,
      locationContext: { province: 'Đắk Lắk' },
      phone: '0901234567',
      cccd: '066099000000'
    });

    const canBoTinh = await User.create({
      username: 'Cán bộ Tỉnh',
      email: 'tinh@daklak.gov.vn',
      password: pwAdmin, // 123456
      role: 'PROVINCE_ADMIN',
      agencyId: provinceAgency._id,
      locationContext: { province: 'Đắk Lắk' },
      phone: '0901111111',
      cccd: '066099000001'
    });

    const canBoHSV = await User.create({
      username: 'Cán bộ HSV VN Tỉnh Đắk Lắk',
      email: 'canbotinh@daklak.hsv.vn',
      password: pwDefault, // Password123!
      role: 'PROVINCE_ADMIN',
      agencyId: hsvProvinceAgency._id,
      locationContext: { province: 'Đắk Lắk' },
      phone: '0901111112',
      cccd: '066099000002'
    });

    const canBoTruong = await User.create({
      username: 'Cán bộ HSV Trường ĐHTN',
      email: 'hsv.dhtn@taynguyen.edu.vn',
      password: pwDefault,
      role: 'ADMIN',
      agencyId: schoolAgency._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột' },
      phone: '0902222222',
      cccd: '066099000003'
    });

    const canBoLCH = await User.create({
      username: 'Cán bộ LCH Khoa KHTN và CN',
      email: 'lch.khtncn@dhtn.edu.vn',
      password: pwDefault,
      role: 'COMMUNE_ADMIN',
      agencyId: lchAgency._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'Khoa KHTN & CN' },
      phone: '0903333333',
      cccd: '066099000004'
    });

    const chiHoiTruong = await User.create({
      username: 'Chi hội trưởng SP Vật lí K23',
      email: 'ch.spvatli.k23@dhtn.edu.vn',
      password: pwDefault,
      role: 'COMMUNE_ADMIN',
      agencyId: chAgency._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'SP Vật lí K23' },
      phone: '0904444444',
      cccd: '066099000005'
    });

    const hoiVien = await User.create({
      username: 'Hội viên SP Vật lí K23',
      email: 'hoivien.spvatli@dhtn.edu.vn',
      password: pwDefault,
      role: 'CITIZEN',
      agencyId: chAgency._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'SP Vật lí K23' },
      phone: '0905555555',
      cccd: '066099000006'
    });

    // ── 4. Tạo 102 Tài khoản Xã/Phường theo dạng Eakar@gmail.com ─────────
    const communeUsers = COMMUNES_LIST.map((communeName, index) => {
      const email = generateCommuneEmail(communeName);
      const phoneIndex = String(index + 1).padStart(7, '0');
      const cccdIndex = String(index + 10).padStart(6, '0');

      return {
        username: communeName,
        email: email,
        password: pwDefault, // Password123!
        role: 'COMMUNE_ADMIN',
        agencyId: agencyMap[communeName] || provinceAgency._id,
        locationContext: {
          province: 'Đắk Lắk',
          district: 'Đắk Lắk',
          commune: communeName
        },
        phone: `090${phoneIndex}`,
        cccd: `066099${cccdIndex}`
      };
    });

    const insertedUsers = await User.insertMany(communeUsers);
    console.log(`✅ Đã tạo thành công ${insertedUsers.length} tài khoản Xã/Phường (Pass: Password123!)`);

    const userMap = {};
    insertedUsers.forEach(u => { userMap[u.username] = u._id; });

    // ── 5. Tạo Dữ liệu Báo cáo 11 Chỉ tiêu cho 102 Xã/Phường ─────────────
    console.log('📊 Đang sinh dữ liệu 11 chỉ tiêu chiến dịch cho 102 Xã/Phường...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const issuesSample = [
      'Một số người lớn tuổi chưa quen dùng smartphone cảm ứng.',
      'Sóng di động tại một số thôn buôn vùng sâu còn yếu khi quét QR.',
      'Bà con bận thu hoạch mùa màng ban ngày nên đội hình ra quân vào chiều tối.',
      'Một vài hộ kinh doanh cần thêm thời gian để mở tài khoản ngân hàng số.',
      'Cần bổ sung thêm tài liệu hướng dẫn VNeID bằng tiếng Êđê.',
      ''
    ];

    const proposalsSample = [
      'Đề xuất Tỉnh Đoàn hỗ trợ thêm tài liệu và standee hướng dẫn đặt tại Bộ phận Một cửa.',
      'Đề xuất phối hợp thêm với VNPT/Viettel nâng cấp đường truyền tại Nhà văn hóa.',
      'Đề xuất tăng cường thêm tình nguyện viên cho các phiên chợ cuối tuần.',
      'Đề xuất mở thêm lớp tập huấn AI ứng dụng bán lẻ cho thanh niên khởi nghiệp.',
      ''
    ];

    const evidenceLinksSample = [
      'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ_EaKar2026',
      'https://facebook.com/doanxaeakar/posts/1029384756',
      'https://drive.google.com/drive/folders/1zYxWvUtSrQpOnMlKjIhGfEdCbA_BMT2026',
      'https://facebook.com/doanthanhnienbuonho/posts/992837465',
      'https://drive.google.com/drive/folders/1QWERTYUIOPASDFGHJKLZXCVBNM_2026'
    ];

    const campaignReports = [];

    insertedAgencies.forEach((agency, idx) => {
      // Xác định nhóm xã
      let isG1 = idx < 32;       // Nhóm 1: Đô thị
      let isG2 = idx >= 32 && idx < 72; // Nhóm 2: Chợ cụm
      let isG3 = idx >= 72;      // Nhóm 3: Nông thôn, vùng sâu

      let digitalSkills, vneidSupport, publicServices, qrSupport, trainingClasses, digitalProducts, youthTrained;

      if (isG1) {
        digitalSkills   = rand(950, 1600);
        vneidSupport    = rand(480, 780);
        publicServices  = rand(310, 520);
        qrSupport       = rand(110, 175);
        trainingClasses = rand(4, 7);
        digitalProducts = rand(9, 15);
        youthTrained    = rand(180, 290);
      } else if (isG2) {
        digitalSkills   = rand(650, 1150);
        vneidSupport    = rand(340, 560);
        publicServices  = rand(200, 360);
        qrSupport       = rand(70, 125);
        trainingClasses = rand(3, 6);
        digitalProducts = rand(7, 12);
        youthTrained    = rand(140, 230);
      } else {
        digitalSkills   = rand(420, 720);
        vneidSupport    = rand(210, 360);
        publicServices  = rand(110, 190);
        qrSupport       = rand(28, 55);
        trainingClasses = rand(2, 5);
        digitalProducts = rand(5, 9);
        youthTrained    = rand(90, 170);
      }

      campaignReports.push({
        agencyId: agency._id,
        reporterId: userMap[agency.name] || canBoTinh._id,
        reportDate: today,
        // 11 Chỉ tiêu chính thức
        digitalSkills: digitalSkills,
        vneidSupport: vneidSupport,
        publicServices: publicServices,
        qrSupport: qrSupport,
        activeTeams: 1,
        trainingClasses: trainingClasses,
        digitalModels: 1,
        digitalProducts: digitalProducts,
        youthTrained: youthTrained,
        youthProjects: 1,
        smartwebCount: rand(1, 3),
        // Bổ trợ
        websitesCreated: rand(1, 2),
        volunteers: rand(18, 45),
        safetyCampaigns: rand(1, 3),
        mediaPosts: rand(2, 6),
        issues: pick(issuesSample),
        proposals: pick(proposalsSample),
        evidenceLinks: pick(evidenceLinksSample),
        createdAt: today,
        updatedAt: today
      });
    });

    await CampaignReport.insertMany(campaignReports);
    console.log(`✅ Đã tạo ${campaignReports.length} Báo cáo 11 chỉ tiêu hằng ngày cho 102 Xã/Phường`);

    // ── 6. Tạo Dữ liệu Đăng ký Website AI.VN SmartWeb ─────────────────────
    console.log('🌐 Đang tạo dữ liệu SmartWeb cho các hộ kinh doanh/tiểu thương...');
    const smartwebData = [
      { ownerName: 'Y Krông Niê', phone: '0912345001', businessName: 'Cà phê Rang xay Êđê Buôn Ma Thuột', businessType: 'NONG_SAN', domain: 'capheedebmt.vn', status: 'ACTIVE', address: 'Buôn Akô Dhông, TP Buôn Ma Thuột' },
      { ownerName: 'Nguyễn Thị Thu Hà', phone: '0912345002', businessName: 'Hợp tác xã Sầu riêng Krông Pắc', businessType: 'NONG_SAN', domain: 'sauriengkrongpac.vn', status: 'ACTIVE', address: 'Thị trấn Phước An, Krông Pắc' },
      { ownerName: 'H’Linh Mlô', phone: '0912345003', businessName: 'Dệt Thổ Cẩm Truyền Thống H’Linh', businessType: 'THU_CONG', domain: 'thocamhlinh.vn', status: 'ACTIVE', address: 'Xã Ea Tul, Cư M’gar' },
      { ownerName: 'Trần Văn Cường', phone: '0912345004', businessName: 'Cửa hàng Mắc ca & Hạt dinh dưỡng Tây Nguyên', businessType: 'NONG_SAN', domain: 'maccataynguyen.vn', status: 'ACTIVE', address: 'Thị trấn Ea Drăng, Ea H’leo' },
      { ownerName: 'Phạm Đức Long', phone: '0912345005', businessName: 'Gara Sửa chữa Xe máy Thông minh Long Phát', businessType: 'DICH_VU', domain: 'longphatgara.vn', status: 'REGISTERED', address: 'Phường Tân Lập, Buôn Ma Thuột' },
      { ownerName: 'Lê Hoàng Nam', phone: '0912345006', businessName: 'Quán Cơm Niêu & Ẩm thực Tây Nguyên', businessType: 'AN_UONG', domain: 'comnieutaynguyen.vn', status: 'ACTIVE', address: 'Phường Tân An, Buôn Ma Thuột' },
      { ownerName: 'Vũ Thị Mai', phone: '0912345007', businessName: 'Thời trang Thổ cẩm Cách tân Mai House', businessType: 'THOI_TRANG', domain: 'maihousethocam.vn', status: 'REGISTERED', address: 'Thị trấn Ea Knốp, Ea Kar' },
      { ownerName: 'Đặng Quốc Bảo', phone: '0912345008', businessName: 'Tiệm Bánh Ngọt & Trà Sữa Ban Mê', businessType: 'AN_UONG', domain: 'banmebakery.vn', status: 'ACTIVE', address: 'Phường Buôn Ma Thuột' },
      { ownerName: 'H’Nhiên Kbuôr', phone: '0912345009', businessName: 'Mật ong Rừng Nguyên chất Ea Súp', businessType: 'NONG_SAN', domain: 'matongeasup.vn', status: 'ACTIVE', address: 'Xã Ea Rốk, Ea Súp' },
      { ownerName: 'Bùi Thanh Tùng', phone: '0912345010', businessName: 'Điện máy & Gia dụng Tùng Phát', businessType: 'BAN_LE', domain: 'dienmaytungphat.vn', status: 'REGISTERED', address: 'Thị trấn M’Drắk' },
      { ownerName: 'Ngô Văn Sơn', phone: '0912345011', businessName: 'Bơ Sáp & Nông sản Sạch Cư M’gar', businessType: 'NONG_SAN', domain: 'bosapcumgar.vn', status: 'PENDING', address: 'Xã Quảng Phú, Cư M’gar' },
      { ownerName: 'Trịnh Thị Lan', phone: '0912345012', businessName: 'Hiệu thuốc Tây Gia đình Tâm Đức', businessType: 'BAN_LE', domain: 'nhathuoctamduc.vn', status: 'CONTACTED', address: 'Phường Buôn Hồ' },
      { ownerName: 'Đỗ Hữu Phước', phone: '0912345013', businessName: 'Hợp tác xã Ca cao Krông Ana', businessType: 'NONG_SAN', domain: 'cacaokrongana.vn', status: 'ACTIVE', address: 'Xã Dray Bhăng, Krông Ana' },
      { ownerName: 'Hoàng Minh Tuấn', phone: '0912345014', businessName: 'Cơ sở Điêu khắc Gỗ & Thủ công Mỹ nghệ Tuấn Gỗ', businessType: 'THU_CONG', domain: 'tuangodaklak.vn', status: 'REGISTERED', address: 'Xã Hòa Sơn, Krông Bông' },
      { ownerName: 'Dương Thị Yến', phone: '0912345015', businessName: 'Trang trại Nấm Linh Chi & Đông Trùng Hạ Thảo', businessType: 'NONG_SAN', domain: 'namlinhchidaklak.vn', status: 'ACTIVE', address: 'Xã Tân Tiến, Krông Pắc' },
    ];

    const smartwebDocs = smartwebData.map((item, i) => {
      const ag = insertedAgencies[i % insertedAgencies.length];
      return {
        ...item,
        trackingCode: `SW-20260817-${String(i + 1).padStart(4, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        agencyId: ag._id,
        websiteUrl: item.domain ? `https://${item.domain}` : '',
        registeredAt: item.status === 'ACTIVE' ? new Date('2026-07-10') : item.status === 'REGISTERED' ? new Date('2026-07-20') : null,
        supportedBy: `Đoàn viên ${ag.name}`,
        supportedPhone: '0988776655',
        notes: item.status === 'ACTIVE' ? 'Đã kích hoạt gian hàng và tích hợp QR thanh toán' : 'Đang hỗ trợ cài đặt giao diện'
      };
    });

    await SmartwebRegistration.insertMany(smartwebDocs);
    console.log(`✅ Đã tạo ${smartwebDocs.length} Đăng ký Website AI.VN SmartWeb`);

    // ── 7. Tạo Dữ liệu Yêu cầu Hỗ trợ từ Người dân (SupportRequest) ────────
    console.log('❤️ Đang tạo dữ liệu Yêu cầu hỗ trợ từ người dân...');
    const supportData = [
      { senderName: 'Y Bham Niê', senderPhone: '0945112233', senderAddress: 'Buôn Cuôr Đăng B, Xã Cuôr Đăng', category: 'DOI_SONG', content: 'Gia đình có người già neo đơn cần hỗ trợ hướng dẫn kích hoạt VNeID mức 2 tại nhà.', urgency: 'MEDIUM', status: 'RESOLVED', resolution: 'Đội hình Thanh niên số đã đến tận nhà kích hoạt VNeID thành công.' },
      { senderName: 'Nguyễn Thị Lụa', senderPhone: '0945223344', senderAddress: 'Thôn 3, Xã Ea Nuôl, Buôn Đôn', category: 'THIEN_TAI', content: 'Mưa lớn làm tốc mái hiên nhà sinh hoạt cộng đồng, cần đoàn viên hỗ trợ chằng chống.', urgency: 'HIGH', status: 'RESOLVED', resolution: 'Đoàn xã cử 6 đoàn viên hỗ trợ lợp lại mái tôn an toàn.' },
      { senderName: 'Lê Văn Tám', senderPhone: '0945334455', senderAddress: 'Chợ Quảng Phú, Cư M’gar', category: 'KHAC', content: 'Tiểu thương sạp vải cần hỗ trợ in bảng mã QR thanh toán động VietQR và VNPay.', urgency: 'LOW', status: 'RESOLVED', resolution: 'Đã tạo và trao tặng bảng mica QR thanh toán miễn phí.' },
      { senderName: 'H’Duyên Knul', senderPhone: '0945445566', senderAddress: 'Buôn Trắp, Krông Ana', category: 'GIAO_DUC', content: 'Các cháu học sinh tiểu học cần hỗ trợ buổi hướng dẫn sử dụng máy tính và tra cứu bài học.', urgency: 'MEDIUM', status: 'IN_PROGRESS', resolution: 'Đang xếp lịch tổ chức tại Nhà văn hóa vào thứ 7 tuần này.' },
      { senderName: 'Trần Đình Trọng', senderPhone: '0945556677', senderAddress: 'Xã Ea Kly, Krông Pắc', category: 'HA_TANG', content: 'Đoạn đường liên thôn có cành cây gãy chắn lối đi của học sinh, cần dọn dẹp.', urgency: 'HIGH', status: 'RESOLVED', resolution: 'Đội hình tình nguyện đã dọn dẹp quang đãng mặt đường.' },
      { senderName: 'Hoàng Văn Thắng', senderPhone: '0945667788', senderAddress: 'Xã Ea Wy, Ea H’Leo', category: 'Y_TE', content: 'Cần hỗ trợ hướng dẫn đăng ký khám chữa bệnh bằng CCCD gắn chip thay thẻ BHYT giấy.', urgency: 'MEDIUM', status: 'RESOLVED', resolution: 'Đã hướng dẫn tích hợp thẻ BHYT vào VNeID thành công.' },
      { senderName: 'Võ Thị Hồng', senderPhone: '0945778899', senderAddress: 'Phường Tân Lập, Buôn Ma Thuột', category: 'KHAC', content: 'Muốn đưa sản phẩm bánh chuối sấy dẻo lên sàn thương mại điện tử và lập fanpage.', urgency: 'LOW', status: 'RECEIVED', resolution: 'Đã chuyển thông tin cho nhóm việc Nông thôn số hỗ trợ.' },
      { senderName: 'Y San Ayun', senderPhone: '0945889900', senderAddress: 'Xã Yang Mao, Krông Bông', category: 'AN_NINH', content: 'Gần đây có số lạ mạo danh công an gọi điện yêu cầu cài app lạ, xin đoàn thanh niên cảnh báo bà con.', urgency: 'CRITICAL', status: 'RESOLVED', resolution: 'Đoàn xã đã phát loa cảnh báo và phát tờ rơi phòng chống lừa đảo trực tuyến.' },
      { senderName: 'Bùi Thị Dung', senderPhone: '0945990011', senderAddress: 'Xã Phú Xuân, Krông Năng', category: 'DOI_SONG', content: 'Hộ cận nghèo cần hỗ trợ thủ tục xin cấp đổi giấy tờ trực tuyến qua Cổng Dịch vụ công.', urgency: 'MEDIUM', status: 'IN_PROGRESS', resolution: 'Cán bộ đoàn đang trực tiếp hướng dẫn nộp hồ sơ tại UBND xã.' },
      { senderName: 'Lý Quốc Bảo', senderPhone: '0945001122', senderAddress: 'Xã Ea Rốk, Ea Súp', category: 'HA_TANG', content: 'Bóng đèn đường chiếu sáng nông thôn bị hỏng cần hỗ trợ kiểm tra thay thế.', urgency: 'LOW', status: 'NEW', resolution: '' },
    ];

    const supportDocs = supportData.map((item, i) => {
      const ag = insertedAgencies[i % insertedAgencies.length];
      return {
        ...item,
        trackingCode: `HT-20260817-${String(i + 1).padStart(4, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        agencyId: ag._id,
        assignedTo: `Đoàn Thanh niên ${ag.name}`,
        assignedPhone: '0909112233',
        assignedAt: new Date(),
        report: item.status === 'RESOLVED' ? {
          volunteersCount: rand(3, 8),
          hoursWorked: rand(2, 5),
          beneficiariesCount: rand(1, 10),
          satisfactionRating: rand(4, 5),
          notes: 'Bà con rất vui và hài lòng với sự nhiệt tình của các bạn trẻ.'
        } : {}
      };
    });

    await SupportRequest.insertMany(supportDocs);
    console.log(`✅ Đã tạo ${supportDocs.length} Yêu cầu hỗ trợ bà con nhân dân`);

    // ── 8. Tạo Dữ liệu Văn bản eOffice (Document) ─────────────────────────
    console.log('📑 Đang tạo dữ liệu Văn bản điện tử eOffice...');
    const docData = [
      {
        type: 'INCOMING',
        documentNumber: '44/KH-UBND',
        issuedDate: new Date('2026-07-01'),
        issuingAgency: 'UBND Tỉnh Đắk Lắk',
        signer: 'Nguyễn Đình Trung',
        signerTitle: 'Chủ tịch UBND Tỉnh',
        summary: 'Kế hoạch triển khai Chiến dịch 44 ngày đêm Thanh niên Đắk Lắk tiên phong chuyển đổi số năm 2026',
        category: 'Kế hoạch',
        field: 'Chuyển đổi số',
        urgency: 'Thượng khẩn',
        status: 'Đang xử lý',
        aiSuggestion: 'Đề xuất phân công Tỉnh Đoàn chủ trì, phối hợp Sở TT&TT đôn đốc 102 xã/phường thực hiện đủ 11 chỉ tiêu.'
      },
      {
        type: 'INCOMING',
        documentNumber: '112/TĐ-CĐS',
        issuedDate: new Date('2026-07-05'),
        issuingAgency: 'Tỉnh Đoàn Đắk Lắk',
        signer: 'H’Giang Niê',
        signerTitle: 'Bí thư Tỉnh Đoàn',
        summary: 'Hướng dẫn thành lập Đội hình Thanh niên số và triển khai phổ cập VNeID mức 2 cho nhân dân',
        category: 'Hướng dẫn',
        field: 'Đoàn Thanh niên',
        urgency: 'Khẩn',
        status: 'Hoàn thành',
        aiSuggestion: 'Đã ban hành mẫu phân nhóm 102 đơn vị xã và kích hoạt cổng nộp báo cáo 18h00 - 20h00 hằng ngày.'
      },
      {
        type: 'OUTGOING',
        documentNumber: '88/BC-STTTT',
        issuedDate: new Date('2026-07-15'),
        issuingAgency: 'Tỉnh Đắk Lắk',
        receivingAgency: 'Bộ Thông tin và Truyền thông',
        signer: 'Trương Hoài Anh',
        signerTitle: 'Giám đốc Sở',
        summary: 'Báo cáo tiến độ triển khai phổ cập thanh toán không tiền mặt và nền tảng AI.VN SmartWeb trên địa bàn tỉnh',
        category: 'Báo cáo',
        field: 'Kinh tế số',
        urgency: 'Thường',
        status: 'Hoàn thành',
        aiSuggestion: 'Tổng hợp số liệu 102 xã đã có hơn 10.000 hộ kinh doanh sử dụng QR thanh toán.'
      },
      {
        type: 'INCOMING',
        documentNumber: '25/TB-VP',
        issuedDate: new Date('2026-07-20'),
        issuingAgency: 'Văn phòng UBND Tỉnh',
        signer: 'Bùi Hồng Quý',
        signerTitle: 'Chánh Văn phòng',
        summary: 'Thông báo Kết luận cuộc họp giao ban trực tuyến về công tác cải cách TTHC và Dịch vụ công trực tuyến',
        category: 'Thông báo',
        field: 'Hành chính công',
        urgency: 'Thường',
        status: 'Đang xử lý',
        aiSuggestion: 'Nhắc nhở các xã đẩy nhanh tiến độ hỗ trợ người dân nộp hồ sơ trực tuyến đạt trên 30.000 lượt.'
      },
      {
        type: 'OUTGOING',
        documentNumber: '56/CV-TĐTN',
        issuedDate: new Date('2026-07-28'),
        issuingAgency: 'Tỉnh Đắk Lắk',
        receivingAgency: '102 Xã/Phường Tỉnh Đắk Lắk',
        signer: 'Y Lê Pas Tơr',
        signerTitle: 'Phó Bí thư Tỉnh Đoàn',
        summary: 'Công văn đôn đốc hoàn thành 100% Công trình thanh niên chuyển đổi số trước ngày tổng kết chiến dịch',
        category: 'Công văn',
        field: 'Phong trào',
        urgency: 'Khẩn',
        status: 'Chờ xử lý',
        aiSuggestion: 'Đề nghị cấp xã kiểm tra lại các mô hình tuyến phố không tiền mặt, chợ số và công trình thanh niên.'
      }
    ];

    const documentDocs = docData.map(d => ({
      ...d,
      agencyId: provinceAgency._id,
      createdBy: canBoTinh._id,
      assignedTo: canBoTinh._id,
      deadline: new Date('2026-08-30')
    }));

    await Document.insertMany(documentDocs);
    console.log(`✅ Đã tạo ${documentDocs.length} Văn bản eOffice`);

    // ── 9. Tạo Dữ liệu Nhiệm vụ eOffice (Task) ────────────────────────────
    console.log('📌 Đang tạo dữ liệu Nhiệm vụ công việc eOffice...');
    const taskData = [
      { title: 'Tổ chức tập huấn AI và Kỹ năng số cho 20.000 đoàn viên thanh niên', priority: 'Cao', status: 'Đang thực hiện', progress: 75, description: 'Phối hợp với các trường đại học, cao đẳng mở lớp trực tuyến và trực tiếp về AI công cụ, Canva, SmartWeb.' },
      { title: 'Kiểm tra, đôn đốc tiến độ nộp báo cáo 11 chỉ tiêu hằng ngày của 102 xã', priority: 'Rất cao', status: 'Đang thực hiện', progress: 85, description: 'Theo dõi hệ thống Dashboard và nhắc nhở các đơn vị nộp trước 20h00 hằng ngày.' },
      { title: 'Số hóa 1.000 sản phẩm OCOP và nông sản đặc trưng địa phương lên sàn số', priority: 'Cao', status: 'Đang thực hiện', progress: 80, description: 'Chụp ảnh sản phẩm, viết bài quảng bá và hỗ trợ các HTX tạo gian hàng trực tuyến.' },
      { title: 'Xây dựng 102 mô hình Chợ số & Tuyến phố không tiền mặt tại 100% xã/phường', priority: 'Rất cao', status: 'Hoàn thành', progress: 100, description: 'Phát mã QR cho tất cả tiểu thương và gắn biển tuyến phố thanh niên chuyển đổi số.' },
      { title: 'Tổng kết và lập hồ sơ khen thưởng Chiến dịch 44 ngày đêm năm 2026', priority: 'Trung bình', status: 'Chưa thực hiện', progress: 10, description: 'Rà soát bảng xếp hạng thi đua DTI của 102 xã để đề xuất UBND Tỉnh tặng Bằng khen.' }
    ];

    const taskDocs = taskData.map(t => ({
      ...t,
      agencyId: provinceAgency._id,
      assignedBy: seniorAdmin._id,
      assignedTo: canBoTinh._id,
      deadline: new Date('2026-08-31'),
      aiGenerated: true,
      aiSolution: 'Đã tự động liên kết số liệu lũy kế từ bảng CampaignReport để theo dõi tiến độ thời gian thực.'
    }));

    await Task.insertMany(taskDocs);
    console.log(`✅ Đã tạo ${taskDocs.length} Nhiệm vụ công việc eOffice`);

    // ── 10. Tạo Dữ liệu Đội hình Tình nguyện (Team) ──────────────────────
    console.log('🏃 Đang tạo dữ liệu Đội hình thanh niên số & tình nguyện...');
    const teamData = [
      {
        name: 'Đội hình Thanh niên số Phường Buôn Ma Thuột',
        schoolOrUnit: 'Đoàn Phường Buôn Ma Thuột',
        createdBy: canBoTinh._id,
        fieldsOfActivity: ['Chuyển đổi số', 'Cải cách hành chính', 'Dịch vụ công'],
        location: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'Phường Buôn Ma Thuột', type: 'Đô thị' },
        timeframe: { startDate: new Date('2026-07-01'), endDate: new Date('2026-08-15') },
        statistics: { volunteersCount: 35, projectsCount: 2, estimatedValue: 120, beneficiaries: 2400 },
        status: 'APPROVED'
      },
      {
        name: 'Đội hình Bình dân học vụ số Xã Ea Kar',
        schoolOrUnit: 'Đoàn Xã Ea Kar',
        createdBy: canBoTinh._id,
        fieldsOfActivity: ['Chuyển đổi số', 'Hỗ trợ tiểu thương QR'],
        location: { province: 'Đắk Lắk', district: 'Huyện Ea Kar', commune: 'Xã Ea Kar', type: 'Nông thôn' },
        timeframe: { startDate: new Date('2026-07-01'), endDate: new Date('2026-08-15') },
        statistics: { volunteersCount: 28, projectsCount: 1, estimatedValue: 80, beneficiaries: 1500 },
        status: 'APPROVED'
      },
      {
        name: 'Đội hình Chợ số & Nông thôn mới Krông Pắc',
        schoolOrUnit: 'Đoàn Xã Krông Pắc',
        createdBy: canBoTinh._id,
        fieldsOfActivity: ['Kinh tế số', 'OCOP số hóa'],
        location: { province: 'Đắk Lắk', district: 'Huyện Krông Pắc', commune: 'Xã Krông Pắc', type: 'Nông thôn' },
        timeframe: { startDate: new Date('2026-07-01'), endDate: new Date('2026-08-15') },
        statistics: { volunteersCount: 30, projectsCount: 2, estimatedValue: 95, beneficiaries: 1800 },
        status: 'APPROVED'
      },
      {
        name: 'Đội hình Tri thức trẻ Trường ĐH Tây Nguyên',
        schoolOrUnit: 'HSV Trường ĐHTN',
        createdBy: canBoTruong._id,
        fieldsOfActivity: ['Tập huấn AI', 'Kỹ năng số cộng đồng'],
        location: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'Phường Tân An', type: 'Đô thị' },
        timeframe: { startDate: new Date('2026-07-01'), endDate: new Date('2026-08-15') },
        statistics: { volunteersCount: 45, projectsCount: 3, estimatedValue: 150, beneficiaries: 3200 },
        status: 'APPROVED'
      },
      {
        name: 'Đội hình An toàn số Buôn Đôn',
        schoolOrUnit: 'Đoàn Xã Buôn Đôn',
        createdBy: canBoTinh._id,
        fieldsOfActivity: ['An toàn thông tin', 'Phòng chống lừa đảo'],
        location: { province: 'Đắk Lắk', district: 'Huyện Buôn Đôn', commune: 'Xã Buôn Đôn', type: 'Nông thôn' },
        timeframe: { startDate: new Date('2026-07-01'), endDate: new Date('2026-08-15') },
        statistics: { volunteersCount: 22, projectsCount: 1, estimatedValue: 60, beneficiaries: 1100 },
        status: 'APPROVED'
      }
    ];

    await Team.insertMany(teamData);
    console.log(`✅ Đã tạo ${teamData.length} Đội hình thanh niên tình nguyện`);

    // ── 11. Tạo Dữ liệu Tin tức Hoạt động (News) ──────────────────────────
    console.log('📰 Đang tạo dữ liệu Tin tức chiến dịch...');
    const newsData = [
      {
        title: 'Chiến dịch 44 ngày đêm: 102 Xã/Phường đồng loạt ra quân đưa Chuyển đổi số đến từng buôn làng',
        content: 'Với phương châm "Bình dân học vụ số - Thanh niên hành động", hơn 3.000 đoàn viên tình nguyện toàn tỉnh Đắk Lắk đã trực tiếp hỗ trợ bà con cài đặt VNeID mức 2, quét mã QR thanh toán tại các chợ truyền thống và hướng dẫn nộp dịch vụ công trực tuyến...',
        imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80',
        author: canBoTinh._id,
        createdAt: new Date('2026-07-02')
      },
      {
        title: 'Hơn 10.000 tiểu thương Đắk Lắk hào hứng sử dụng mã QR thanh toán không tiền mặt',
        content: 'Chỉ sau 3 tuần ra quân, mô hình "Chợ số - Tuyến phố không tiền mặt" đã được triển khai rộng khắp tại Buôn Ma Thuột, Ea Kar, Krông Pắc và Buôn Hồ, giúp tiểu thương quản lý tài chính minh bạch và an toàn.',
        imageUrl: 'https://images.unsplash.com/photo-1556742049-0a67e5572293?auto=format&fit=crop&w=800&q=80',
        author: canBoTinh._id,
        createdAt: new Date('2026-07-18')
      },
      {
        title: 'Đoàn viên thanh niên Đắk Lắk ứng dụng Trí tuệ Nhân tạo (AI) hỗ trợ số hóa sản phẩm OCOP',
        content: 'Các lớp tập huấn AI ứng dụng thực tế do Tỉnh Đoàn tổ chức đã giúp các bạn trẻ nhanh chóng thiết kế bao bì, tạo nội dung giới thiệu nông sản sầu riêng, cà phê, mắc ca và tạo website AI.VN SmartWeb cho bà con nông dân.',
        imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
        author: canBoTinh._id,
        createdAt: new Date('2026-07-25')
      },
      {
        title: 'Hiệu quả từ việc nộp báo cáo 11 chỉ tiêu trực tiếp trên nền tảng số Webgov',
        content: 'Việc chuyển đổi sang nộp báo cáo online 11 chỉ tiêu từ 18:00 – 20:00 hằng ngày giúp cán bộ cấp xã tiết kiệm 90% thời gian làm báo cáo giấy, số liệu được tổng hợp tức thời lên Dashboard chỉ huy toàn tỉnh.',
        imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
        author: seniorAdmin._id,
        createdAt: new Date('2026-08-01')
      }
    ];

    await News.insertMany(newsData);
    console.log(`✅ Đã tạo ${newsData.length} Bài viết tin tức`);

    // ── 12. Tạo Dữ liệu Kho Dữ Liệu Dùng Chung (SharedFile) ───────────────
    console.log('📁 Đang tạo kho dữ liệu tài liệu chia sẻ eOffice...');
    const folderDoc = await SharedFile.create({
      title: 'Tài liệu Hướng dẫn Chuyển đổi số 2026',
      isFolder: true,
      uploadedBy: seniorAdmin._id,
      agencyId: provinceAgency._id
    });

    await SharedFile.create([
      {
        title: 'Sổ tay Hướng dẫn 11 Chỉ tiêu Chiến dịch 44 ngày đêm.pdf',
        currentFile: { fileName: 'so_tay_11_chi_tieu.pdf', fileSize: 4250000, mimeType: 'application/pdf' },
        uploadedBy: canBoTinh._id,
        agencyId: provinceAgency._id,
        parentId: folderDoc._id
      },
      {
        title: 'Tài liệu Tập huấn Trí tuệ Nhân tạo (AI) cho Cán bộ Đoàn.docx',
        currentFile: { fileName: 'tap_huan_ai_2026.docx', fileSize: 1850000, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        uploadedBy: canBoTinh._id,
        agencyId: provinceAgency._id,
        parentId: folderDoc._id
      },
      {
        title: 'Bộ nhận diện Banner & Poster Tuyên truyền An toàn số.zip',
        currentFile: { fileName: 'bo_nhan_dien_cds.zip', fileSize: 12500000, mimeType: 'application/zip' },
        uploadedBy: seniorAdmin._id,
        agencyId: provinceAgency._id,
        parentId: folderDoc._id
      }
    ]);
    console.log('✅ Đã tạo Kho dữ liệu chia sẻ SharedFile');

    // ── 13. Tạo Nhật Ký Hoạt Động (ActivityLog) ──────────────────────────
    const logs = [
      { user: seniorAdmin._id, action: 'SYSTEM_INIT', target: 'Hệ thống Webgov', details: 'Khởi tạo dữ liệu mẫu và đồng bộ 11 chỉ tiêu chiến dịch' },
      { user: canBoTinh._id, action: 'EXPORT_DTI_EXCEL', target: 'Báo cáo DTI', details: 'Xuất file Excel tổng hợp 11 chỉ tiêu toàn tỉnh' },
      { user: canBoTinh._id, action: 'APPROVE_TEAM', target: 'Đội hình Thanh niên số', details: 'Phê duyệt kế hoạch ra quân cho các xã' },
      { user: canBoHSV._id, action: 'CREATE_DOCUMENT', target: 'Kế hoạch #44/KH-UBND', details: 'Ban hành văn bản triển khai chuyển đổi số' },
    ];
    await ActivityLog.insertMany(logs);
    console.log(`✅ Đã tạo ${logs.length} Nhật ký hoạt động`);

    console.log('');
    console.log('🎉 🎉 🎉 NẠP TOÀN BỘ DỮ LIỆU GIẢ THÀNH CÔNG RỰC RỠ! 🎉 🎉 🎉');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('📌 TỔNG KẾT HỆ THỐNG:');
    console.log(`   - 🏛️ Số Cơ quan / Xã Phường: ${insertedAgencies.length + 5} đơn vị`);
    console.log(`   - 👤 Số Tài khoản Xã Phường: ${insertedUsers.length} tài khoản (Pass: Password123!)`);
    console.log(`   - 📊 Số Báo cáo 11 Chỉ tiêu: ${campaignReports.length} bản ghi hôm nay (tổng hợp DTI đầy đủ)`);
    console.log(`   - 🌐 Số Đăng ký SmartWeb: ${smartwebDocs.length} hộ kinh doanh/HTX`);
    console.log(`   - ❤️ Số Yêu cầu Hỗ trợ bà con: ${supportDocs.length} yêu cầu`);
    console.log(`   - 📑 Số Văn bản eOffice: ${documentDocs.length} văn bản`);
    console.log(`   - 📌 Số Nhiệm vụ eOffice: ${taskDocs.length} công việc`);
    console.log(`   - 🏃 Số Đội hình Tình nguyện: ${teamData.length} đội hình`);
    console.log(`   - 📰 Số Bài viết Tin tức: ${newsData.length} tin bài`);
    console.log('───────────────────────────────────────────────────────────────────────────────────────────────────────────────');
    console.log('🔑 TÀI KHOẢN ĐĂNG NHẬP THỬ NGHIỆM:');
    console.log('   1. Super Admin:       admin@daklak.gov.vn         | Pass: 123456');
    console.log('   2. Cán bộ Tỉnh:       tinh@daklak.gov.vn          | Pass: 123456');
    console.log('   3. Cán bộ Tỉnh Đoàn:  canbotinh@daklak.hsv.vn     | Pass: Password123!');
    console.log('   4. Cán bộ Xã Ea Kar:  Eakar@gmail.com             | Pass: Password123!');
    console.log('   5. Cán bộ BMT:        Buonmathuot@gmail.com       | Pass: Password123!');
    console.log('   6. Cán bộ Krông Pắc:  Krongpac@gmail.com          | Pass: Password123!');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi khi seed dữ liệu:', err);
    process.exit(1);
  }
}

seed();
