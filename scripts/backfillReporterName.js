/**
 * MIGRATION SCRIPT: Backfill reporterName cho báo cáo cũ
 * Chạy 1 lần: node scripts/backfillReporterName.js
 * 
 * Logic:
 *   1. Tìm tất cả báo cáo có reporterName rỗng/null
 *   2. Thử populate reporterId → lấy username
 *   3. Nếu user đã bị xoá → dùng "Cán bộ Đoàn [tên xã]"
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/webgov_daklak';

// ── Models ──────────────────────────────────────────────────────────────────
const CampaignReport = require('../models/CampaignReport');
const User           = require('../models/User');
const Agency         = require('../models/Agency');

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Đã kết nối MongoDB:', MONGODB_URI);

  // Lấy tất cả báo cáo chưa có reporterName
  const reports = await CampaignReport.find({
    $or: [
      { reporterName: { $exists: false } },
      { reporterName: '' },
      { reporterName: null },
    ]
  })
    .populate('reporterId', 'username email fullName')
    .populate('agencyId', 'name');

  console.log(`📋 Tìm thấy ${reports.length} báo cáo cần backfill...`);

  let updated   = 0;
  let fromUser  = 0;
  let fromAgency = 0;
  let unknown   = 0;

  for (const r of reports) {
    let name = '';

    // Ưu tiên 1: từ User đang còn tồn tại
    if (r.reporterId?.username) {
      name = r.reporterId.username;
      fromUser++;
    } else if (r.reporterId?.email) {
      name = r.reporterId.email;
      fromUser++;
    }
    // Ưu tiên 2: từ tên đơn vị (agency)
    else if (r.agencyId?.name) {
      name = `Cán bộ Đoàn ${r.agencyId.name}`;
      fromAgency++;
    }
    // Cuối cùng
    else {
      name = 'Không xác định';
      unknown++;
    }

    await CampaignReport.updateOne(
      { _id: r._id },
      { $set: { reporterName: name } }
    );
    updated++;

    if (updated % 20 === 0) {
      console.log(`   ✏️  Đã xử lý ${updated}/${reports.length}...`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ Backfill hoàn tất!`);
  console.log(`   📊 Tổng cập nhật : ${updated} báo cáo`);
  console.log(`   👤 Từ User DB     : ${fromUser}`);
  console.log(`   🏢 Từ tên Agency  : ${fromAgency}`);
  console.log(`   ❓ Không xác định : ${unknown}`);
  console.log('═══════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Lỗi migration:', err);
  process.exit(1);
});
