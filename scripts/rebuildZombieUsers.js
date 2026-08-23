/**
 * rebuildZombieUsers.js
 * Phân tích các userId "zombie" (có trong JWT nhưng không có trong DB)
 * và tạo lại tài khoản cho họ với agencyId mới.
 * 
 * Cách dùng: node Backend/scripts/rebuildZombieUsers.js
 * 
 * Các userId zombie lấy từ log server (JWT agencyId cũ bắt đầu bằng 6a828acb...)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Agency = require('../models/Agency');

// ── Danh sách agencyId CŨ (từ log) → tên xã tương ứng ──────────────────────
// Lấy từ pattern log: người dùng của xã nào đang dùng agencyId cũ nào
// Ta cần map: OLD_AGENCY_ID → commune_name → NEW_AGENCY_ID
const OLD_AGENCY_IDS_FROM_LOG = [
  '6a828acb73bbde95c1377ea8',
  '6a828acb73bbde95c1377ed2',
  '6a828acb73bbde95c1377e83',
  // Thêm các ID khác từ log nếu có
];

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/webgov_daklak').then(async () => {
  console.log('✅ Kết nối MongoDB\n');

  // ── 1. Kiểm tra các agencyId cũ này có tồn tại trong DB hiện tại không ──
  console.log('🔍 Kiểm tra các Old Agency ID từ log:');
  for (const oldId of OLD_AGENCY_IDS_FROM_LOG) {
    const ag = await Agency.findById(oldId);
    console.log(`  ${oldId}: ${ag ? `✅ Tồn tại (${ag.name})` : '❌ KHÔNG tồn tại (zombie ref)'}`);
  }

  // ── 2. Thống kê users hiện tại ─────────────────────────────────────────
  console.log('\n📊 Thống kê User hiện tại:');
  const totalUsers = await User.countDocuments();
  const communeAdmins = await User.countDocuments({ role: 'COMMUNE_ADMIN' });
  console.log(`   Tổng users: ${totalUsers} | COMMUNE_ADMIN: ${communeAdmins}`);

  // ── 3. Liệt kê tất cả COMMUNE_ADMIN không có email dễ nhận dạng ─────────
  console.log('\n📋 Danh sách COMMUNE_ADMIN và agency của họ:');
  const admins = await User.find({ role: 'COMMUNE_ADMIN' })
    .populate('agencyId', 'name')
    .sort({ 'locationContext.commune': 1 })
    .lean();

  admins.forEach(u => {
    const hasAgency = !!u.agencyId;
    const marker = hasAgency ? '✅' : '❌';
    console.log(`  ${marker} ${u.email} | ${u.locationContext?.commune || 'TRỐNG'} | Agency: ${u.agencyId?.name || 'NULL'}`);
  });

  // ── 4. Kiểm tra có xã nào không có tài khoản COMMUNE_ADMIN ──────────────
  console.log('\n🔍 Kiểm tra xã nào thiếu tài khoản:');
  const allAgencies = await Agency.find({ level: 'COMMUNE' }).lean();
  const userCommuneSet = new Set(admins.map(u => String(u.agencyId?._id || u.agencyId)));

  let missingCount = 0;
  for (const ag of allAgencies) {
    if (!userCommuneSet.has(String(ag._id))) {
      console.log(`  ⚠️  "${ag.name}" (${ag._id}) → KHÔNG CÓ tài khoản cán bộ`);
      missingCount++;
    }
  }
  if (missingCount === 0) console.log('  ✅ Tất cả xã đều có ít nhất 1 tài khoản cán bộ');
  else console.log(`\n  ⚠️  ${missingCount} đơn vị thiếu tài khoản → Cần tạo lại thủ công qua giao diện Admin`);

  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
