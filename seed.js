require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Team = require('./models/Team');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/webgov_daklak';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB for Seeding...');
    
    // Clear old data
    await User.deleteMany({});
    await Team.deleteMany({});
    
    const pw = await bcrypt.hash('123456', 10);
    
    // ── Create Users (all 5 roles) ──────────────────────────
    const seniorAdmin = await User.create({
      username: 'Super Admin Hệ thống',
      email: 'admin@daklak.gov.vn',
      password: pw,
      role: 'SENIOR_ADMIN',
      locationContext: { province: 'Đắk Lắk' }
    });

    const admin = await User.create({
      username: 'Admin Truyền thông',
      email: 'content@daklak.gov.vn',
      password: pw,
      role: 'ADMIN',
      locationContext: { province: 'Đắk Lắk' }
    });

    const provinceAdmin = await User.create({
      username: 'Tỉnh Đoàn Đắk Lắk',
      email: 'tinh@daklak.gov.vn',
      password: pw,
      role: 'PROVINCE_ADMIN',
      locationContext: { province: 'Đắk Lắk' }
    });

    const communeAdmin = await User.create({
      username: 'Cán bộ Xã Ea Tu',
      email: 'xa_eatu@daklak.gov.vn',
      password: pw,
      role: 'COMMUNE_ADMIN',
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột', commune: 'Xã Ea Tu' }
    });

    const citizen = await User.create({
      username: 'Nguyễn Văn An',
      email: 'nguoidan@gmail.com',
      password: pw,
      role: 'CITIZEN',
      locationContext: { province: 'Đắk Lắk', district: 'TP Buôn Ma Thuột' }
    });
    
    // ── Create sample Teams ─────────────────────────────────
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
    
    console.log('');
    console.log('✅ Seeded successfully!');
    console.log('');
    console.log('📋 Tài khoản test:');
    console.log('─────────────────────────────────────────');
    console.log('  Super Admin  │ admin@daklak.gov.vn      │ 123456');
    console.log('  Admin        │ content@daklak.gov.vn    │ 123456');
    console.log('  Cán bộ Tỉnh  │ tinh@daklak.gov.vn       │ 123456');
    console.log('  Cán bộ Xã    │ xa_eatu@daklak.gov.vn    │ 123456');
    console.log('  Người dân    │ nguoidan@gmail.com       │ 123456');
    console.log('─────────────────────────────────────────');
    console.log(`  ${5} teams đã được tạo (3 APPROVED, 2 PENDING)`);
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
