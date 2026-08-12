require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Agency = require('./models/Agency');
const Team = require('./models/Team');
const News = require('./models/News');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/webgov_daklak';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB for Seeding...');
    
    // Clear old data
    await User.deleteMany({});
    await Agency.deleteMany({});
    await Team.deleteMany({});
    await News.deleteMany({});
    
    // Create Hash Passwords
    const pwDefault = await bcrypt.hash('123456', 10);
    const pwCustom = await bcrypt.hash('Password123!', 10);

    // ── 1. Create Agencies (Đơn vị phân cấp HSV) ──────────────────────────
    const provinceAgency = await Agency.create({
      name: 'HSV VN Tỉnh Đắk Lắk',
      level: 'PROVINCE',
      description: 'Hội Sinh viên Việt Nam Tỉnh Đắk Lắk'
    });

    const schoolAgency = await Agency.create({
      name: 'HSV Trường ĐHTN',
      level: 'MINISTRY',
      parentAgency: provinceAgency._id,
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

    console.log('✅ Đã tạo các Đơn vị tổ chức HSV các cấp (Province, School, Inter-branch, Branch)');
    
    // ── 2. Create Users (5 Cấp theo yêu cầu người dùng) ──────────────────────────
    
    // 1. Cấp Cán bộ tỉnh
    const canBoTinh = await User.create({
      username: 'Cán bộ HSV VN Tỉnh Đắk Lắk',
      email: 'canbotinh@daklak.hsv.vn',
      password: pwCustom,
      role: 'PROVINCE_ADMIN',
      agencyId: provinceAgency._id,
      locationContext: { province: 'Đắk Lắk' },
      phone: '0901111111',
      cccd: '066099000001'
    });

    // 2. Cấp HSV trường
    const canBoTruong = await User.create({
      username: 'Cán bộ HSV Trường ĐHTN',
      email: 'hsv.dhtn@taynguyen.edu.vn',
      password: pwCustom,
      role: 'ADMIN',
      agencyId: schoolAgency._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột' },
      phone: '0902222222',
      cccd: '066099000002'
    });

    // 3. Cấp Liên chi hội
    const canBoLCH = await User.create({
      username: 'Cán bộ LCH Khoa KHTN và CN',
      email: 'lch.khtncn@dhtn.edu.vn',
      password: pwCustom,
      role: 'COMMUNE_ADMIN',
      agencyId: lchAgency._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'Khoa KHTN & CN' },
      phone: '0903333333',
      cccd: '066099000003'
    });

    // 4. Cấp Chi hội
    const chiHoiTruong = await User.create({
      username: 'Chi hội trưởng SP Vật lí K23',
      email: 'ch.spvatli.k23@dhtn.edu.vn',
      password: pwCustom,
      role: 'COMMUNE_ADMIN',
      agencyId: chAgency._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'SP Vật lí K23' },
      phone: '0904444444',
      cccd: '066099000004'
    });

    // 5. Cấp Hội viên
    const hoiVien = await User.create({
      username: 'Hội viên SP Vật lí K23',
      email: 'hoivien.spvatli@dhtn.edu.vn',
      password: pwCustom,
      role: 'CITIZEN',
      agencyId: chAgency._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'SP Vật lí K23' },
      phone: '0905555555',
      cccd: '066099000005'
    });

    // Bổ sung tài khoản Super Admin mặc định hệ thống
    const seniorAdmin = await User.create({
      username: 'Super Admin Hệ thống',
      email: 'admin@daklak.gov.vn',
      password: pwDefault,
      role: 'SENIOR_ADMIN',
      agencyId: provinceAgency._id,
      locationContext: { province: 'Đắk Lắk' },
      phone: '0901234567',
      cccd: '066099001122'
    });

    console.log('✅ Đã tạo 5 tài khoản mẫu phân cấp HSV + Super Admin');

    // ── 3. Create Sample Teams (Đội hình Tình nguyện) ──────────────────────────
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

    // ── 4. Create Sample News (Tin tức truyền thông) ──────────────────────────
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
    console.log('🎉 🎉 🎉 DỮ LIỆU MẪU ĐÃ ĐƯỢC NẠP THÀNH CÔNG! 🎉 🎉 🎉');
    console.log('');
    console.log('📋 DANH SÁCH TÀI KHOẢN MẪU PHÂN CẤP HSV (Password: Password123!):');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('  Phân Cấp Cán Bộ     │ Role Code      │ Email                   │ Mật khẩu     │ Tên hiển thị & Đơn vị');
    console.log('──────────────────────┼────────────────┼─────────────────────────┼──────────────┼──────────────────────────────');
    console.log('  1. Cấp Cán bộ tỉnh  │ PROVINCE_ADMIN │ canbotinh@daklak.hsv.vn │ Password123! │ Cán bộ HSV VN Tỉnh Đắk Lắk');
    console.log('  2. Cấp HSV trường   │ ADMIN          │ hsv.dhtn@taynguyen.edu.vn│ Password123! │ Cán bộ HSV Trường ĐHTN');
    console.log('  3. Cấp Liên chi hội │ COMMUNE_ADMIN  │ lch.khtncn@dhtn.edu.vn  │ Password123! │ Cán bộ LCH Khoa KHTN và CN');
    console.log('  4. Cấp Chi hội      │ COMMUNE_ADMIN  │ ch.spvatli.k23@dhtn.edu.vn│ Password123!│ Chi hội trưởng SP Vật lí K23');
    console.log('  5. Cấp Hội viên     │ CITIZEN        │ hoivien.spvatli@dhtn.edu.vn│ Password123!│ Hội viên SP Vật lí K23');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('✨ Đã nạp thành công 4 cơ quan tổ chức, 5 tài khoản mẫu chính thức, 4 đội hình mẫu và 2 tin tức.');
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();

