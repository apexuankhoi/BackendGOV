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

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔗 Đã kết nối cơ sở dữ liệu MongoDB:', MONGODB_URI);

    // ── 0. Xóa sạch toàn bộ dữ liệu cũ để đưa số liệu về 0 ───────────────
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
    console.log('🧹 Đã xóa sạch toàn bộ dữ liệu giả cũ (Tiến độ 11 chỉ tiêu & Đội hình về 0)');

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

    // ── 5. Tiến độ 11 Chỉ tiêu & Đội hình: ĐƯỢC GIỮ Ở MỨC 0 ──────────────
    // Toàn bộ bảng CampaignReport và Team không chứa số liệu giả.
    // Các xã sẽ tự cập nhật số liệu thực tế qua form nộp báo cáo hằng ngày.
    console.log('✅ Tiến độ 11 chỉ tiêu: 0 (Chưa có báo cáo nào, chờ 102 xã nộp hằng ngày)');
    console.log('✅ Đội hình thanh niên số & tình nguyện: 0 đội hình');
    console.log('✅ Đăng ký SmartWeb: 0 gian hàng');
    console.log('✅ Yêu cầu hỗ trợ: 0 yêu cầu');

    // ── 6. Tạo Dữ liệu Văn bản ban hành (Khung hướng dẫn) ────────────────
    const docData = [
      {
        type: 'INCOMING',
        documentNumber: '44/KH-UBND',
        issuedDate: new Date(),
        issuingAgency: 'UBND Tỉnh Đắk Lắk',
        signer: 'Nguyễn Đình Trung',
        signerTitle: 'Chủ tịch UBND Tỉnh',
        summary: 'Kế hoạch triển khai Chiến dịch 44 ngày đêm Thanh niên Đắk Lắk tiên phong chuyển đổi số năm 2026',
        category: 'Kế hoạch',
        field: 'Chuyển đổi số',
        urgency: 'Thượng khẩn',
        status: 'Đang xử lý',
        agencyId: provinceAgency._id,
        createdBy: canBoTinh._id,
        assignedTo: canBoTinh._id,
        deadline: new Date('2026-08-31')
      },
      {
        type: 'INCOMING',
        documentNumber: '112/TĐ-CĐS',
        issuedDate: new Date(),
        issuingAgency: 'Tỉnh Đoàn Đắk Lắk',
        signer: 'H’Giang Niê',
        signerTitle: 'Bí thư Tỉnh Đoàn',
        summary: 'Hướng dẫn thành lập Đội hình Thanh niên số và triển khai 11 chỉ tiêu chuyển đổi số cấp xã/phường',
        category: 'Hướng dẫn',
        field: 'Đoàn Thanh niên',
        urgency: 'Khẩn',
        status: 'Đang xử lý',
        agencyId: provinceAgency._id,
        createdBy: canBoTinh._id,
        assignedTo: canBoTinh._id,
        deadline: new Date('2026-08-31')
      }
    ];
    await Document.insertMany(docData);

    // ── 7. Tạo Bài viết Tin tức & Sự kiện Chuyển đổi số ────────────────
    await News.create([
      {
        title: 'UBND và Tỉnh Đoàn Đắk Lắk phát động Chiến dịch 44 ngày đêm Chuyển đổi số năm 2026',
        summary: 'Chiến dịch tập trung vào 11 chỉ tiêu trọng điểm: hỗ trợ kỹ năng số cộng đồng, kích hoạt VNeID mức 2, DVC trực tuyến, thanh toán không tiền mặt QR, thành lập Đội hình Thanh niên số và phổ cập AI.',
        content: 'Sáng nay, UBND tỉnh phối hợp cùng Ban Thường vụ Tỉnh Đoàn Đắk Lắk đã long trọng tổ chức Lễ phát động "Chiến dịch 44 ngày đêm Thanh niên Đắk Lắk tiên phong Chuyển đổi số năm 2026".\n\nChiến dịch đặt mục tiêu đột phá với 11 chỉ tiêu chiến lược trên toàn bộ 102 xã, phường, thị trấn:\n1. 100% xã/phường thành lập Đội hình Thanh niên số hoạt động tích cực.\n2. Tối thiểu 500 người dân/xã được hướng dẫn kỹ năng số và cài đặt VNeID mức 2.\n3. 100% hồ sơ TTHC đủ điều kiện được nộp qua Cổng Dịch vụ công trực tuyến.\n4. Phổ cập thanh toán mã QR không dùng tiền mặt tại các chợ truyền thống và hộ kinh doanh.\n5. Đào tạo ứng dụng Trí tuệ nhân tạo (AI) trong công việc cho cán bộ cơ sở.\n6. Phổ cập website thương mại điện tử .VN SmartWeb cho thanh niên khởi nghiệp và nông sản OCOP.\n\nPhát biểu chỉ đạo, đại diện UBND tỉnh nhấn mạnh tinh thần "Đi từng ngõ, gõ từng nhà, hướng dẫn từng người dân" để không ai bị bỏ lại phía sau trên hành trình chuyển đổi số.',
        imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
        category: 'Chiến dịch 44 ngày đêm',
        views: 342,
        author: canBoTinh._id
      },
      {
        title: 'Đội hình Thanh niên số ra quân hướng dẫn Dịch vụ công và kích hoạt VNeID mức 2',
        summary: 'Hàng trăm đoàn viên thanh niên đã trực tiếp xuống các buôn làng, khu dân cư để hỗ trợ bà con cài đặt VNeID, nộp hồ sơ DVC và thanh toán trực tuyến.',
        content: 'Tại các điểm sinh hoạt cộng đồng và UBND các xã, phường, Đội hình Thanh niên số đã thiết lập các "Bàn hướng dẫn chuyển đổi số lưu động". Các bạn trẻ kiên trì hướng dẫn từng cụ già, người dân cách tra cứu thông tin, nộp hồ sơ trực tuyến, thanh toán tiền điện, nước qua ứng dụng ngân hàng và kích hoạt tài khoản định danh điện tử VNeID mức 2.\n\nHoạt động đã nhận được sự hưởng ứng nhiệt tình và đánh giá cao từ người dân địa phương.',
        imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
        category: 'Thanh niên số',
        views: 215,
        author: canBoHSV._id
      },
      {
        title: 'Chương trình "Mỗi hộ kinh doanh một Website .VN" - Đột phá thương mại điện tử qua AI.VN SmartWeb',
        summary: 'Nền tảng AI.VN SmartWeb hỗ trợ miễn phí 100% xây dựng website chuẩn TMĐT và đăng ký tên miền .VN cho tiểu thương, HTX trên địa bàn Đắk Lắk.',
        content: 'Nhằm thúc đẩy kinh tế số nông thôn và nâng cao năng lực cạnh tranh cho các hộ kinh doanh, nền tảng AI.VN SmartWeb đã ra mắt gói tài trợ đặc biệt trong Chiến dịch 44 ngày đêm.\n\nChỉ với 5 phút khai báo, các chủ cơ sở kinh doanh, HTX cà phê, sầu riêng, macca và các sản phẩm OCOP đặc trưng có ngay một website bán hàng chuyên nghiệp, tích hợp thanh toán online và chatbot AI tư vấn tự động.',
        imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
        category: 'SmartWeb & AI',
        views: 189,
        author: seniorAdmin._id
      },
      {
        title: 'Nhân rộng mô hình "Tuyến phố không tiền mặt" tại trung tâm các huyện, thị xã',
        summary: '100% tiểu thương, quán ăn, sạp chợ truyền thống cam kết sử dụng mã QR thanh toán không dùng tiền mặt, hướng tới đô thị văn minh hiện đại.',
        content: 'Đoàn Thanh niên phối hợp với Ngân hàng Nhà nước và các ngân hàng thương mại trên địa bàn tỉnh triển khai phủ kín mã QR động và tĩnh tại các tuyến đường trục chính.\n\nMô hình giúp người dân mua sắm tiện lợi, an toàn, giảm thiểu rủi ro tiền mặt và minh bạch hóa giao dịch kinh doanh.',
        imageUrl: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=1200&q=80',
        category: 'Mô hình điểm',
        views: 156,
        author: canBoTruong._id
      },
      {
        title: 'Tập huấn ứng dụng Trí tuệ nhân tạo (AI) cho Cán bộ Đoàn 102 Xã/Phường tỉnh Đắk Lắk',
        summary: 'Trang bị kỹ năng viết báo cáo tự động, tạo ảnh truyền thông, tóm tắt văn bản và xây dựng trợ lý ảo phục vụ công tác điều hành tại cơ sở.',
        content: 'Khóa tập huấn chuyên sâu "Ứng dụng AI nâng cao năng suất công tác Đoàn và Quản lý Nhà nước" đã thu hút hơn 300 cán bộ Đoàn và đoàn viên nòng cốt.\n\nCác học viên được thực hành trực tiếp các công cụ AI hiện đại để xử lý dữ liệu báo cáo 11 chỉ tiêu, soạn thảo văn bản, thiết kế infographic truyền thông chiến dịch chỉ trong vài phút.',
        imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
        category: 'Tập huấn & Đào tạo',
        views: 278,
        author: canBoLCH._id
      },
      {
        title: 'Số hóa 100% sản phẩm OCOP Đắk Lắk lên Bản đồ số nông sản và sàn TMĐT',
        summary: 'Các sản phẩm đặc sản Đắk Lắk như Cà phê Buôn Ma Thuột, Mật ong hoa cà phê, Bơ sáp, Tiêu Đắk Lắk được gắn mã QR truy xuất nguồn gốc số.',
        content: 'Đoàn khối Nông nghiệp cùng các đội hình tri thức trẻ đã hỗ trợ các chủ thể OCOP hoàn thiện hồ sơ điện tử, chụp ảnh sản phẩm 3D, tích hợp mã QR truy xuất nguồn gốc và đưa sản phẩm lên các sàn thương mại điện tử lớn của Việt Nam.',
        imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
        category: 'Chuyển đổi số',
        views: 198,
        author: canBoTinh._id
      }
    ]);

    // ── 8. Tạo Kho Tài liệu Hướng dẫn Dùng Chung ─────────────────────────
    const folderDoc = await SharedFile.create({
      title: 'Tài liệu Hướng dẫn 11 Chỉ tiêu Chuyển đổi số 2026',
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
      }
    ]);

    console.log('');
    console.log('🎉 🎉 🎉 ĐÃ RESET TOÀN BỘ TIẾN ĐỘ & SỐ LIỆU VỀ 0 THÀNH CÔNG! 🎉 🎉 🎉');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('📌 TRẠNG THÁI HIỆN TẠI:');
    console.log(`   - 🏛️ Số Cơ quan: ${insertedAgencies.length + 5} đơn vị (Tỉnh + 102 Xã/Phường sẵn sàng)`);
    console.log(`   - 👤 Số Tài khoản Xã Phường: ${insertedUsers.length} tài khoản (Pass: Password123!)`);
    console.log(`   - 📊 Tiến độ 11 Chỉ tiêu: 0 / 100% (Sạch sẽ, chờ nộp thực tế)`);
    console.log(`   - 🏃 Số Đội hình: 0 đội hình`);
    console.log(`   - 🌐 Số Website SmartWeb: 0`);
    console.log(`   - ❤️ Số Yêu cầu hỗ trợ: 0`);
    console.log('───────────────────────────────────────────────────────────────────────────────────────────────────────────────');
    console.log('🔑 TÀI KHOẢN ĐĂNG NHẬP:');
    console.log('   1. Super Admin:       admin@daklak.gov.vn         | Pass: 123456');
    console.log('   2. Cán bộ Tỉnh:       tinh@daklak.gov.vn          | Pass: 123456');
    console.log('   3. Cán bộ Tỉnh Đoàn:  canbotinh@daklak.hsv.vn     | Pass: Password123!');
    console.log('   4. 102 Cán bộ Xã:     [Tenxa]@gmail.com           | Pass: Password123!');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi khi seed dữ liệu:', err);
    process.exit(1);
  }
}

seed();
