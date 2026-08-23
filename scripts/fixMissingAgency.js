/**
 * fixMissingAgency.js
 * Script sửa tất cả User không có agencyId bằng cách tra cứu theo locationContext.commune
 * Chạy: node Backend/scripts/fixMissingAgency.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Agency = require('../models/Agency');

async function fixMissingAgency() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/webgov');
  console.log('✅ Đã kết nối MongoDB');

  const users = await User.find({ agencyId: null, 'locationContext.commune': { $exists: true, $ne: '' } });
  console.log(`📋 Tìm thấy ${users.length} tài khoản chưa có agencyId\n`);

  let fixed = 0;
  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const comm = user.locationContext?.commune;
    if (!comm) { skipped++; continue; }

    const clean = comm.replace(/^(Xã|Phường|Đoàn xã|Đoàn phường)\s*/i, '').trim();

    // Thử các pattern khớp theo thứ tự ưu tiên
    let agency = await Agency.findOne({ name: comm });
    if (!agency) agency = await Agency.findOne({ name: { $regex: `^${clean}$`, $options: 'i' } });
    if (!agency) agency = await Agency.findOne({ name: { $regex: clean, $options: 'i' } });

    if (agency) {
      user.agencyId = agency._id;
      await user.save();
      console.log(`  ✔ [${user.email}] → ${agency.name}`);
      fixed++;
    } else {
      // Tạo mới Agency nếu chưa tồn tại
      agency = await Agency.create({
        name: comm,
        level: 'COMMUNE',
        province: user.locationContext?.province || 'Đắk Lắk',
        description: `${comm} - Tự động tạo bởi script fixMissingAgency`
      });
      user.agencyId = agency._id;
      await user.save();
      console.log(`  ✨ [${user.email}] → Tạo mới Agency "${comm}"`);
      created++;
    }
  }

  console.log(`\n📊 Kết quả:`);
  console.log(`  - Sửa thành công:  ${fixed} tài khoản`);
  console.log(`  - Tạo mới Agency:  ${created} đơn vị`);
  console.log(`  - Bỏ qua (trống):  ${skipped} tài khoản`);
  process.exit(0);
}

fixMissingAgency().catch(err => { console.error(err); process.exit(1); });
