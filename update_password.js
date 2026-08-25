require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Agency = require('./models/Agency');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/webgov_daklak';

// MẬT KHẨU MUỐN THAY ĐỔI
const NEW_PASSWORD = process.env.NEW_PASSWORD || 'Password123!';

async function updatePasswordOnly() {
  console.log('================================================================');
  console.log('🔑 BẮT ĐẦU CẬP NHẬT MẬT KHẨU CHO 102 TÀI KHOẢN XÃ/PHƯỜNG');
  console.log('🛡️ (CHỈ ĐỔI MẬT KHẨU — GIỮ NGUYÊN TÀI KHOẢN, BÁO CÁO & DỮ LIỆU)');
  console.log('================================================================\n');

  console.log('🔗 Đang kết nối MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Đã kết nối cơ sở dữ liệu thành công!\n');

  console.log(`🔐 Đang mã hóa mật khẩu mới: "${NEW_PASSWORD}"...`);
  const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
  console.log('✅ Mã hóa hoàn tất!\n');

  // Lấy toàn bộ tài khoản COMMUNE_ADMIN
  const communeUsers = await User.find({ role: 'COMMUNE_ADMIN' })
    .populate('agencyId', 'name')
    .sort({ 'locationContext.commune': 1, username: 1 });

  console.log(`👥 Tìm thấy ${communeUsers.length} tài khoản cấp Xã/Phường trong hệ thống:\n`);

  let count = 0;
  for (const user of communeUsers) {
    user.password = hashedPassword;
    await user.save();
    count++;
    const communeName = user.agencyId?.name || user.locationContext?.commune || user.username;
    console.log(`   ✅ [${count}/${communeUsers.length}] "${communeName}" -> Email: ${user.email} | Mật khẩu mới: ${NEW_PASSWORD} | AgencyId: ${user.agencyId?._id || user.agencyId}`);
  }

  console.log('\n============================================================');
  console.log('🎉 HOÀN TẤT ĐỔI MẬT KHẨU THÀNH CÔNG!');
  console.log(`👥 Đã cập nhật: ${count} tài khoản Xã/Phường.`);
  console.log(`🔑 Mật khẩu đăng nhập mới: ${NEW_PASSWORD}`);
  console.log('🛡️ 100% dữ liệu báo cáo, chỉ tiêu và ID tài khoản được giữ nguyên vẹn.');
  console.log('============================================================\n');

  await mongoose.disconnect();
}

updatePasswordOnly().catch(err => {
  console.error('❌ Lỗi khi đổi mật khẩu:', err);
  process.exit(1);
});
