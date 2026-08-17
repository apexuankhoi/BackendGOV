require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Agency = require('./models/Agency');
const Team = require('./models/Team');
const News = require('./models/News');

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

// Hàm chuyển đổi tên xã phường sang email dạng Pascal/Camel: Eakar@gmail.com
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

    // ── Xoá sạch dữ liệu cũ ───────────────────────────────────────────
    await User.deleteMany({});
    await Agency.deleteMany({});
    await Team.deleteMany({});
    await News.deleteMany({});
    console.log('🧹 Đã xóa sạch dữ liệu cũ');

    // Khởi tạo mật khẩu mã hoá
    const pwDefault = await bcrypt.hash('Password123!', 10);
    const pwAdmin = await bcrypt.hash('123456', 10);

    // ── 1. Tạo Cơ quan cấp Tỉnh ──────────────────────────────────────────
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

    console.log('🏛 Đã tạo các Đơn vị tổ chức cấp Tỉnh & Đơn vị trực thuộc');

    // ── 2. Tạo 102 Cơ quan cấp Xã/Phường ──────────────────────────────────
    const communeAgencyDocs = COMMUNES_LIST.map((communeName) => ({
      name: communeName,
      level: 'COMMUNE',
      parentAgency: provinceAgency._id,
      description: `Cấp Xã/Phường - ${communeName}`
    }));

    const insertedAgencies = await Agency.insertMany(communeAgencyDocs);
    console.log(`🏘 Đã tạo ${insertedAgencies.length} Cơ quan cấp Xã/Phường trực thuộc Tỉnh Đắk Lắk`);

    // Tạo Map từ tên xã -> agencyId
    const agencyMap = {};
    insertedAgencies.forEach((ag) => {
      agencyMap[ag.name] = ag._id;
    });

    // ── 3. Tạo 102 Tài khoản Xã/Phường theo dạng Eakar@gmail.com ─────────
    const communeUsers = COMMUNES_LIST.map((communeName, index) => {
      const email = generateCommuneEmail(communeName);
      const phoneIndex = String(index + 1).padStart(7, '0');
      const cccdIndex = String(index + 1).padStart(6, '0');

      return {
        username: communeName,
        email: email,
        password: pwDefault, // Mật khẩu mặc định: Password123!
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
    console.log(`✅ Đã tạo thành công ${insertedUsers.length} tài khoản Xã/Phường dạng Eakar@gmail.com`);

    // ── 4. Tạo các Tài khoản Quản trị & Mẫu theo phân cấp ────────────────
    const seniorAdmin = await User.create({
      username: 'Super Admin Hệ thống',
      email: 'admin@daklak.gov.vn',
      password: pwAdmin, // Mật khẩu: 123456
      role: 'SENIOR_ADMIN',
      agencyId: provinceAgency._id,
      locationContext: { province: 'Đắk Lắk' },
      phone: '0901234567',
      cccd: '066099000000'
    });

    const canBoTinh = await User.create({
      username: 'Cán bộ HSV VN Tỉnh Đắk Lắk',
      email: 'canbotinh@daklak.hsv.vn',
      password: pwDefault, // Password123!
      role: 'PROVINCE_ADMIN',
      agencyId: hsvProvinceAgency._id,
      locationContext: { province: 'Đắk Lắk' },
      phone: '0901111111',
      cccd: '066099000001'
    });

    const canBoTruong = await User.create({
      username: 'Cán bộ HSV Trường ĐHTN',
      email: 'hsv.dhtn@taynguyen.edu.vn',
      password: pwDefault,
      role: 'ADMIN',
      agencyId: schoolAgency._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột' },
      phone: '0902222222',
      cccd: '066099000002'
    });

    const canBoLCH = await User.create({
      username: 'Cán bộ LCH Khoa KHTN và CN',
      email: 'lch.khtncn@dhtn.edu.vn',
      password: pwDefault,
      role: 'COMMUNE_ADMIN',
      agencyId: lchAgency._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'Khoa KHTN & CN' },
      phone: '0903333333',
      cccd: '066099000003'
    });

    const chiHoiTruong = await User.create({
      username: 'Chi hội trưởng SP Vật lí K23',
      email: 'ch.spvatli.k23@dhtn.edu.vn',
      password: pwDefault,
      role: 'COMMUNE_ADMIN',
      agencyId: chAgency._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'SP Vật lí K23' },
      phone: '0904444444',
      cccd: '066099000004'
    });

    const hoiVien = await User.create({
      username: 'Hội viên SP Vật lí K23',
      email: 'hoivien.spvatli@dhtn.edu.vn',
      password: pwDefault,
      role: 'CITIZEN',
      agencyId: chAgency._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'SP Vật lí K23' },
      phone: '0905555555',
      cccd: '066099000005'
    });

    console.log('✅ Đã tạo các tài khoản Quản trị cấp Tỉnh, Trường, Super Admin');

    // ── 5. Tạo dữ liệu mẫu Đội hình & Tin tức ───────────────────────────
    await Team.create([
      {
        name: 'Mùa Hè Xanh Bách Khoa',
        schoolOrUnit: 'ĐH Bách Khoa HCM',
        createdBy: canBoLCH._id,
        fieldsOfActivity: ['Chuyển đổi số', 'Xây dựng nông thôn mới'],
        location: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'Xã Ea Tu', type: 'Nông thôn' },
        timeframe: { startDate: new Date('2026-06-15'), endDate: new Date('2026-07-15') },
        statistics: { volunteersCount: 45, projectsCount: 3, estimatedValue: 150, beneficiaries: 320 },
        status: 'APPROVED'
      },
      {
        name: 'Đội hình Y Tế Vì Dân - ĐHTN',
        schoolOrUnit: 'ĐH Tây Nguyên',
        createdBy: chiHoiTruong._id,
        fieldsOfActivity: ['Y tế - Sức khoẻ cộng đồng', 'Chăm sóc thiếu nhi'],
        location: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'Xã Ea Tu', type: 'Nông thôn' },
        timeframe: { startDate: new Date('2026-06-20'), endDate: new Date('2026-07-20') },
        statistics: { volunteersCount: 30, projectsCount: 2, estimatedValue: 100, beneficiaries: 450 },
        status: 'APPROVED'
      },
      {
        name: 'Tri Thức Trẻ Khoa KHTN&CN',
        schoolOrUnit: 'Khoa KHTN & CN - ĐHTN',
        createdBy: canBoLCH._id,
        fieldsOfActivity: ['Giáo dục', 'Chuyển đổi số'],
        location: { province: 'Đắk Lắk', district: 'Huyện Krông Pắc', commune: 'TT Phước An', type: 'Đô thị' },
        timeframe: { startDate: new Date('2026-07-01'), endDate: new Date('2026-07-30') },
        statistics: { volunteersCount: 25, projectsCount: 1, estimatedValue: 50, beneficiaries: 200 },
        status: 'APPROVED'
      },
      {
        name: 'Chi Hội Vật Lý Tình Nguyện',
        schoolOrUnit: 'Chi hội SP Vật lí K23',
        createdBy: chiHoiTruong._id,
        fieldsOfActivity: ['Bảo vệ môi trường', 'Giáo dục'],
        location: { province: 'Đắk Lắk', district: 'Huyện Krông Búk', commune: 'Xã Cư Né', type: 'Nông thôn' },
        timeframe: { startDate: new Date('2026-06-25'), endDate: new Date('2026-07-25') },
        statistics: { volunteersCount: 35, projectsCount: 2, estimatedValue: 80, beneficiaries: 150 },
        status: 'APPROVED'
      }
    ]);

    await News.create([
      {
        title: 'Hội Sinh viên VN Tỉnh Đắk Lắk ra quân Chiến dịch Thanh niên Tình nguyện Hè 2026',
        content: 'Sáng nay, HSV Tỉnh Đắk Lắk đã tổ chức lễ ra quân Chiến dịch Thanh niên tình nguyện Hè 2026 với sự tham gia của hàng nghìn hội viên sinh viên...',
        imageUrl: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=800&q=80',
        author: canBoTinh._id
      },
      {
        title: 'Liên chi hội Khoa KHTN & CN ĐHTN đẩy mạnh các hoạt động chuyển đổi số',
        content: 'Các đội hình tình nguyện Khoa KHTN & CN đã hỗ trợ người dân và sinh viên tiếp cận các nền tảng công nghệ mới...',
        imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80',
        author: canBoLCH._id
      }
    ]);

    console.log('');
    console.log('🎉 🎉 🎉 DỮ LIỆU SEED ĐÃ ĐƯỢC NẠP THÀNH CÔNG! 🎉 🎉 🎉');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('📌 TỔNG KẾT:');
    console.log(`   - Số Cơ quan đã tạo: ${insertedAgencies.length + 5} (Gồm Tỉnh + 102 Xã/Phường + Phân cấp HSV)`);
    console.log(`   - Số Tài khoản Xã/Phường: ${insertedUsers.length} tài khoản (Mật khẩu mặc định: Password123!)`);
    console.log(`   - Tài khoản Super Admin: admin@daklak.gov.vn (Mật khẩu: 123456)`);
    console.log('───────────────────────────────────────────────────────────────────────────────────────────────────────────────');
    console.log('📋 MẪU 10 TÀI KHOẢN XÃ/PHƯỜNG ĐẦU TIÊN:');
    communeUsers.slice(0, 10).forEach((u, i) => {
      console.log(`   ${i + 1}. [${u.username}] -> Email: ${u.email} | Pass: Password123! | Role: ${u.role}`);
    });
    console.log(`   ... và ${communeUsers.length - 10} tài khoản xã phường khác (ví dụ: Xã Ea Kar -> Eakar@gmail.com).`);
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi khi seed dữ liệu:', err);
    process.exit(1);
  }
}

seed();
