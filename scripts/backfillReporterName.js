/**
 * MIGRATION SCRIPT: Backfill reporterName cho báo cáo cũ
 * Chạy 1 lần: node scripts/backfillReporterName.js
 * 
 * Chuỗi fallback:
 *   1. reporterId.username   (user còn tồn tại)
 *   2. reporterId.email      (user còn tồn tại)
 *   3. agencyId.name         (populate thành công)
 *   4. Agency.findById(rawId) (populate thất bại — thử lại thẳng)
 *   5. User.findById(rawId)  (populate thất bại — thử lại thẳng)
 *   6. "Cán bộ Đoàn (ngày DD/MM/YYYY)"
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/webgov_daklak';

const CampaignReport = require('../models/CampaignReport');
const User           = require('../models/User');
const Agency         = require('../models/Agency');

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Đã kết nối MongoDB:', MONGODB_URI);

  // Lấy raw documents (không populate) để giữ ObjectId gốc
  const rawReports = await CampaignReport.find({
    $or: [
      { reporterName: { $exists: false } },
      { reporterName: '' },
      { reporterName: null },
    ]
  }).lean(); // .lean() trả về plain JS object, giữ nguyên ObjectId

  console.log(`📋 Tìm thấy ${rawReports.length} báo cáo cần backfill...\n`);

  let updated    = 0;
  let fromUser   = 0;
  let fromAgency = 0;
  let fromDate   = 0;

  for (const r of rawReports) {
    let name = '';
    let source = '';

    // ── Bước 1: Thử populate reporterId ──────────────────────────────────
    if (r.reporterId) {
      const user = await User.findById(r.reporterId).select('username email fullName').lean();
      if (user?.username) {
        name   = user.username;
        source = 'User.username';
        fromUser++;
      } else if (user?.email) {
        name   = user.email;
        source = 'User.email';
        fromUser++;
      }
    }

    // ── Bước 2: Thử lấy tên từ agencyId ─────────────────────────────────
    if (!name && r.agencyId) {
      const agency = await Agency.findById(r.agencyId).select('name').lean();
      if (agency?.name) {
        name   = `Cán bộ Đoàn ${agency.name}`;
        source = 'Agency.name';
        fromAgency++;
      }
    }

    // ── Bước 3: Fallback cuối — ghi ngày báo cáo ─────────────────────────
    if (!name) {
      const d = r.reportDate ? new Date(r.reportDate).toLocaleDateString('vi-VN') : '?';
      name   = `Cán bộ Đoàn (ngày ${d})`;
      source = 'date-fallback';
      fromDate++;
    }

    await CampaignReport.updateOne(
      { _id: r._id },
      { $set: { reporterName: name } }
    );
    updated++;
    console.log(`   [${updated}/${rawReports.length}] ${source.padEnd(14)} → "${name}"`);
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ Backfill hoàn tất!`);
  console.log(`   📊 Tổng cập nhật : ${updated} báo cáo`);
  console.log(`   👤 Từ User DB     : ${fromUser}`);
  console.log(`   🏢 Từ Agency DB   : ${fromAgency}`);
  console.log(`   📅 Từ ngày BC     : ${fromDate}  (user + agency đều đã bị xóa)`);
  console.log('═══════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Lỗi migration:', err);
  process.exit(1);
});
