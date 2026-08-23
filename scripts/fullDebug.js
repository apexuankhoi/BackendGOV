/**
 * fullDebug.js - Điều tra toàn diện nguyên nhân lỗi "chưa liên kết đơn vị"
 * Chạy: node Backend/scripts/fullDebug.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Agency = require('../models/Agency');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/webgov_daklak').then(async () => {
  console.log('====================================================');
  console.log('       FULL DEBUG: AGENCY LINKING INVESTIGATION      ');
  console.log('====================================================\n');

  // ── 1. Thống kê tổng quát ──────────────────────────────────────────────
  const totalUsers = await User.countDocuments();
  const totalAgencies = await Agency.countDocuments();
  const communeAgencies = await Agency.countDocuments({ level: 'COMMUNE' });
  
  console.log(`📊 TỔNG QUAN:`);
  console.log(`   Users: ${totalUsers} | Agencies: ${totalAgencies} (${communeAgencies} COMMUNE)\n`);

  // ── 2. Kiểm tra từng COMMUNE_ADMIN ────────────────────────────────────
  const admins = await User.find({ role: { $in: ['COMMUNE_ADMIN', 'PROVINCE_ADMIN'] } }).lean();
  console.log(`👥 CÁN BỘ CÓ THỂ NỘP BÁO CÁO: ${admins.length} tài khoản\n`);

  const allAgencies = await Agency.find({}).lean();
  const agencyMap = new Map(allAgencies.map(a => [String(a._id), a]));

  let okCount = 0;
  let problems = [];

  for (const u of admins) {
    const agencyId = u.agencyId;
    const commune = u.locationContext?.commune || '';
    
    // Kiểm tra agencyId tồn tại
    let agency = agencyId ? agencyMap.get(String(agencyId)) : null;
    
    if (!agency) {
      // Thử tìm theo commune
      const clean = commune.replace(/^(Xã|Phường|Đoàn xã|Đoàn phường)\s*/i, '').trim();
      const found = allAgencies.find(a => 
        a.name === commune ||
        a.name.toLowerCase() === commune.toLowerCase() ||
        a.name.toLowerCase().includes(clean.toLowerCase()) ||
        clean.toLowerCase().includes(a.name.toLowerCase())
      );

      problems.push({
        email: u.email,
        username: u.username,
        role: u.role,
        agencyIdInDB: agencyId ? String(agencyId) : 'NULL',
        agencyExists: !!agency,
        commune: commune || 'TRỐNG',
        communeMatchFound: !!found,
        communeMatchName: found?.name || 'Không khớp'
      });
    } else {
      okCount++;
    }
  }

  console.log(`✅ Hợp lệ: ${okCount}/${admins.length}`);
  
  if (problems.length > 0) {
    console.log(`\n❌ CÓ VẤN ĐỀ: ${problems.length} tài khoản\n`);
    problems.forEach(p => {
      console.log(`  📧 ${p.email} (${p.username})`);
      console.log(`     Role: ${p.role}`);
      console.log(`     agencyId trong DB: ${p.agencyIdInDB}`);
      console.log(`     Agency tồn tại: ${p.agencyExists ? '✅' : '❌ KHÔNG'}`);
      console.log(`     Commune: "${p.commune}"`);
      console.log(`     Có thể khớp commune: ${p.communeMatchFound ? `✅ "${p.communeMatchName}"` : '❌ Không tìm được'}`);
      console.log('');
    });
  } else {
    console.log('\n🎉 Không tìm thấy vấn đề nào trong DB!\n');
    console.log('⚠️  NHẬN XÉT: Lỗi có thể do:');
    console.log('   1. Server VPS chưa được restart với code mới');
    console.log('   2. JWT token của user được issue TRƯỚC khi agencyId được gán');
    console.log('      → User cần đăng nhập lại để lấy token mới');
    console.log('   3. Có file .js khác trong server VPS còn code cũ (cần kiểm tra git diff)');
  }

  // ── 3. Kiểm tra sample Agency để debug ────────────────────────────────
  console.log('\n────────────────────────────────────────────────');
  console.log('📋 MẪU 5 AGENCY COMMUNE ĐẦU TIÊN:');
  const sampleAgencies = await Agency.find({ level: 'COMMUNE' }).limit(5).lean();
  sampleAgencies.forEach(a => console.log(`   "${a.name}" (${a._id})`));

  // ── 4. Kiểm tra sample User ────────────────────────────────────────────
  console.log('\n📋 MẪU 5 USER COMMUNE_ADMIN ĐẦU TIÊN:');
  const sampleUsers = await User.find({ role: 'COMMUNE_ADMIN' }).limit(5).lean();
  sampleUsers.forEach(u => console.log(`   "${u.email}" | commune: "${u.locationContext?.commune}" | agencyId: ${u.agencyId}`));

  // ── 5. Kiểm tra province field tồn tại trong Agency không ────────────
  const hasProvince = await Agency.findOne({ province: { $exists: true } });
  console.log(`\n📌 Agency có field 'province': ${hasProvince ? '✅ Có' : '❌ Không (schema không có field này!)'}`);
  
  process.exit(0);
}).catch(err => { console.error('❌ Lỗi kết nối:', err.message); process.exit(1); });
