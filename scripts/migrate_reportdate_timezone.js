/**
 * migrate_reportdate_timezone.js
 * 
 * Fix tất cả CampaignReport bị lưu sai timezone:
 *   Cũ (sai): "2026-08-15T17:00:00.000Z" (midnight Vietnam = T17 UTC)
 *   Mới (đúng): "2026-08-16T00:00:00.000Z" (UTC midnight)
 * 
 * Chạy: node migrate_reportdate_timezone.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function run() {
  console.log('🔌 Kết nối MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Kết nối thành công\n');

  const db = mongoose.connection.db;
  const col = db.collection('campaignreports');

  // Tìm tất cả doc có reportDate giờ UTC != 0 (tức là bị lưu theo local time)
  const docs = await col.find({
    $expr: {
      $ne: [{ $hour: '$reportDate' }, 0]
    }
  }).toArray();

  console.log(`📋 Tìm thấy ${docs.length} báo cáo cần migrate\n`);

  if (docs.length === 0) {
    console.log('✅ Không có gì cần fix!');
    await mongoose.disconnect();
    return;
  }

  let fixed = 0;
  let errors = 0;

  for (const doc of docs) {
    const oldDate = doc.reportDate;
    
    // Dịch chuyển về UTC midnight của ngày Vietnam đúng
    // VD: 2026-08-15T17:00:00Z + 7h = 2026-08-16T00:00:00+07 → lấy date = Aug 16
    const vnDate = new Date(oldDate.getTime() + 7 * 60 * 60 * 1000);
    const y = vnDate.getUTCFullYear();
    const m = vnDate.getUTCMonth();
    const d = vnDate.getUTCDate();
    const newDate = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));

    try {
      await col.updateOne(
        { _id: doc._id },
        { $set: { reportDate: newDate } }
      );
      console.log(`  ✅ ${doc._id} | ${oldDate.toISOString()} → ${newDate.toISOString()}`);
      fixed++;
    } catch (err) {
      console.log(`  ❌ ${doc._id} | Lỗi: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n🎉 Hoàn tất! Fixed: ${fixed} | Errors: ${errors}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
