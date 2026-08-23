/**
 * deepAudit.js - Kiểm tra toàn diện: tất cả user có agencyId hợp lệ không
 * Chạy: node Backend/scripts/deepAudit.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Agency = require('../models/Agency');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/webgov_daklak').then(async () => {
  console.log('✅ Kết nối MongoDB\n');

  const allUsers = await User.find({}).lean();
  const allAgencies = await Agency.find({}).lean();
  const agencyMap = new Map(allAgencies.map(a => [String(a._id), a]));

  console.log(`📊 Tổng: ${allUsers.length} users | ${allAgencies.length} agencies\n`);

  let problems = [];

  for (const u of allUsers) {
    if (u.role !== 'COMMUNE_ADMIN' && u.role !== 'PROVINCE_ADMIN') continue;

    const hasAgencyId = !!u.agencyId;
    const agencyExists = hasAgencyId && agencyMap.has(String(u.agencyId));
    const hasCommune = !!(u.locationContext?.commune);

    if (!agencyExists) {
      problems.push({
        email: u.email,
        role: u.role,
        agencyId: u.agencyId || 'NULL',
        commune: u.locationContext?.commune || 'TRỐNG',
        problem: !hasAgencyId ? 'NO_AGENCY_ID' : 'DEAD_REF'
      });
    }
  }

  if (problems.length === 0) {
    console.log('🎉 TẤT CẢ tài khoản cán bộ đều có agencyId hợp lệ!');
  } else {
    console.log(`⚠️  Tìm thấy ${problems.length} tài khoản CÓ VẤN ĐỀ:\n`);
    problems.forEach(p => {
      console.log(`  Email: ${p.email}`);
      console.log(`  Role: ${p.role} | agencyId: ${p.agencyId} | commune: ${p.commune}`);
      console.log(`  Vấn đề: ${p.problem}\n`);
    });

    // TỰ ĐỘNG FIX
    console.log('🔧 Đang tự động sửa...\n');
    for (const p of problems) {
      const user = await User.findOne({ email: p.email });
      if (!user) continue;

      const comm = user.locationContext?.commune;
      if (!comm) {
        console.log(`  ⚠️  ${p.email}: Không có commune → cần Admin gán tay`);
        continue;
      }

      const clean = comm.replace(/^(Xã|Phường|Đoàn xã|Đoàn phường)\s*/i, '').trim();
      let ag = await Agency.findOne({ name: comm });
      if (!ag) ag = await Agency.findOne({ name: { $regex: `^${clean}$`, $options: 'i' } });
      if (!ag) ag = await Agency.findOne({ name: { $regex: clean, $options: 'i' } });

      if (ag) {
        user.agencyId = ag._id;
        await user.save();
        console.log(`  ✔ ${p.email} → gán Agency "${ag.name}"`);
      } else {
        // Tạo mới
        ag = await Agency.create({
          name: comm,
          level: 'COMMUNE',
          province: user.locationContext?.province || 'Đắk Lắk',
          description: `${comm} - Tự động tạo bởi deepAudit`
        });
        user.agencyId = ag._id;
        await user.save();
        console.log(`  ✨ ${p.email} → Tạo mới Agency "${comm}"`);
      }
    }
  }

  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
