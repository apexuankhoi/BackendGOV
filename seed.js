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
    
    // Create Hash Password for '123456'
    const pw = await bcrypt.hash('123456', 10);

    // ── 1. Create Agencies (Đơn vị phân cấp) ──────────────────────────
    const provinceAgency = await Agency.create({
      name: 'Tỉnh Đắk Lắk',
      level: 'PROVINCE',
      description: 'UBND / Tỉnh Đoàn Tỉnh Đắk Lắk'
    });

    const communeAgencyEaTu = await Agency.create({
      name: 'Xã Ea Tu',
      level: 'COMMUNE',
      parentAgency: provinceAgency._id,
      description: 'UBND / Đoàn Thanh niên Xã Ea Tu, TP Buôn Ma Thuột'
    });

    const communeAgencyTanAn = await Agency.create({
      name: 'Phường Tân An',
      level: 'COMMUNE',
      parentAgency: provinceAgency._id,
      description: 'UBND / Đoàn Thanh niên Phường Tân An, TP Buôn Ma Thuột'
    });

    console.log('✅ Đã tạo các Đơn vị hành chính (Agencies): Tỉnh Đắk Lắk, Xã Ea Tu, Phường Tân An');
    
    // ── 2. Create Users (Đầy đủ 5 cấp phân quyền) ──────────────────────────
    const seniorAdmin = await User.create({
      username: 'Super Admin Hệ thống',
      email: 'admin@daklak.gov.vn',
      password: pw,
      role: 'SENIOR_ADMIN',
      agencyId: provinceAgency._id,
      locationContext: { province: 'Đắk Lắk' },
      phone: '0901234567',
      cccd: '066099001122'
    });

    const admin = await User.create({
      username: 'Admin Truyền thông',
      email: 'content@daklak.gov.vn',
      password: pw,
      role: 'ADMIN',
      agencyId: provinceAgency._id,
      locationContext: { province: 'Đắk Lắk' },
      phone: '0902345678',
      cccd: '066099002233'
    });

    const provinceAdmin = await User.create({
      username: 'Tỉnh Đoàn Đắk Lắk',
      email: 'tinh@daklak.gov.vn',
      password: pw,
      role: 'PROVINCE_ADMIN',
      agencyId: provinceAgency._id,
      locationContext: { province: 'Đắk Lắk' },
      phone: '0903456789',
      cccd: '066099003344'
    });

    const communeAdmin = await User.create({
      username: 'Cán bộ Xã Ea Tu',
      email: 'xa_eatu@daklak.gov.vn',
      password: pw,
      role: 'COMMUNE_ADMIN',
      agencyId: communeAgencyEaTu._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'Xã Ea Tu' },
      phone: '0904567890',
      cccd: '066099004455'
    });

    const citizen = await User.create({
      username: 'Nguyễn Văn An',
      email: 'nguoidan@gmail.com',
      password: pw,
      role: 'CITIZEN',
      agencyId: communeAgencyEaTu._id,
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'Xã Ea Tu' },
      phone: '0905678901',
      cccd: '066099005566'
    });
    
    // ── 3. Create Sample Teams (Đội hình Tình nguyện) ──────────────────────────
    await Team.create([
      {
        name: 'Mùa Hè Xanh Bách Khoa',
        schoolOrUnit: 'ĐH Bách Khoa HCM',
        createdBy: communeAdmin._id,
        fieldsOfActivity: ['Chuyển đổi số', 'Xây dựng nông thôn mới'],
        location: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'Xã Ea Tu', type: 'Nông thôn' },
        timeframe: { startDate: new Date('2026-06-15'), endDate: new Date('2026-07-15') },
        statistics: { volunteersCount: 45, projectsCount: 3, estimatedValue: 150, beneficiaries: 320 },
        status: 'APPROVED'
      },
      {
        name: 'Đội hình Y Tế Vì Dân',
        schoolOrUnit: 'ĐH Y Dược HCM',
        createdBy: communeAdmin._id,
        fieldsOfActivity: ['Y tế - Sức khoẻ cộng đồng', 'Chăm sóc thiếu nhi'],
        location: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'Xã Ea Tu', type: 'Nông thôn' },
        timeframe: { startDate: new Date('2026-06-20'), endDate: new Date('2026-07-20') },
        statistics: { volunteersCount: 30, projectsCount: 2, estimatedValue: 100, beneficiaries: 450 },
        status: 'PENDING'
      },
      {
        name: 'Ánh Sáng Tri Thức',
        schoolOrUnit: 'ĐH Sư Phạm HCM',
        createdBy: communeAdmin._id,
        fieldsOfActivity: ['Giáo dục', 'Văn hoá - Nghệ thuật'],
        location: { province: 'Đắk Lắk', district: 'Huyện Krông Pắc', commune: 'TT Phước An', type: 'Đô thị' },
        timeframe: { startDate: new Date('2026-07-01'), endDate: new Date('2026-07-30') },
        statistics: { volunteersCount: 25, projectsCount: 1, estimatedValue: 50, beneficiaries: 200 },
        status: 'APPROVED'
      },
      {
        name: 'Nông thôn mới Công nghệ',
        schoolOrUnit: 'ĐH Công nghệ Thông tin',
        createdBy: communeAdmin._id,
        fieldsOfActivity: ['Chuyển đổi số', 'Nông nghiệp sạch'],
        location: { province: 'Đắk Lắk', district: 'Huyện Krông Búk', commune: 'Xã Cư Né', type: 'Nông thôn' },
        timeframe: { startDate: new Date('2026-06-25'), endDate: new Date('2026-07-25') },
        statistics: { volunteersCount: 35, projectsCount: 2, estimatedValue: 80, beneficiaries: 150 },
        status: 'APPROVED'
      },
      {
        name: 'Đội hình Xanh Ea H\'leo',
        schoolOrUnit: 'ĐH Nông Lâm HCM',
        createdBy: communeAdmin._id,
        fieldsOfActivity: ['Bảo vệ môi trường', 'Phòng chống thiên tai'],
        location: { province: 'Đắk Lắk', district: 'Huyện Ea H\'leo', commune: 'TT Ea Drăng', type: 'Đô thị' },
        timeframe: { startDate: new Date('2026-07-05'), endDate: new Date('2026-08-05') },
        statistics: { volunteersCount: 40, projectsCount: 4, estimatedValue: 200, beneficiaries: 500 },
        status: 'PENDING'
      }
    ]);

    // ── 4. Create Sample News (Tin tức truyền thông) ──────────────────────────
    await News.create([
      {
        title: 'Đắk Lắk ra quân Chiến dịch Thanh niên Tình nguyện Hè 2026',
        content: 'Sáng nay, Tỉnh Đoàn Đắk Lắk đã tổ chức lễ ra quân Chiến dịch Thanh niên tình nguyện Hè 2026 với sự tham gia của hơn 1.000 đoàn viên thanh niên...',
        imageUrl: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=800&q=80',
        author: admin._id
      },
      {
        title: 'Tuổi trẻ Xã Ea Tu tích cực hỗ trợ người dân Chuyển đổi số',
        content: 'Đội hình tình nguyện Chuyển đổi số tại Xã Ea Tu đã hỗ trợ hơn 500 người dân cài đặt tài khoản VNeID và dịch vụ công trực tuyến...',
        imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80',
        author: communeAdmin._id
      }
    ]);
    
    console.log('');
    console.log('🎉 🎉 🎉 SEEDED SUCCESSFULLY! 🎉 🎉 🎉');
    console.log('');
    console.log('📋 BẢNG TÀI KHOẢN TEST DÀNH CHO CÁC CẤP PHÂN QUYỀN:');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('  Phân Cấp            │ Role Code      │ Email                   │ Mật khẩu │ Đơn vị (Agency)');
    console.log('──────────────────────┼────────────────┼─────────────────────────┼──────────┼──────────────────────');
    console.log('  1. Super Admin      │ SENIOR_ADMIN   │ admin@daklak.gov.vn     │ 123456   │ Tỉnh Đắk Lắk');
    console.log('  2. Admin Truyền thông│ ADMIN          │ content@daklak.gov.vn   │ 123456   │ Tỉnh Đắk Lắk');
    console.log('  3. Cán bộ Cấp Tỉnh  │ PROVINCE_ADMIN │ tinh@daklak.gov.vn      │ 123456   │ Tỉnh Đắk Lắk');
    console.log('  4. Cán bộ Cấp Xã    │ COMMUNE_ADMIN  │ xa_eatu@daklak.gov.vn   │ 123456   │ Xã Ea Tu');
    console.log('  5. Người dân        │ CITIZEN        │ nguoidan@gmail.com      │ 123456   │ Xã Ea Tu');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('✨ Đã nạp 3 đơn vị hành chính, 5 tài khoản test, 5 đội hình mẫu và 2 tin tức truyền thông.');
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
