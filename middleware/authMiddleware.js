const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const SECRET = process.env.JWT_SECRET || 'webgov_secret_key_12345';

module.exports = async (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'Truy cập bị từ chối' });

  try {
    const verified = jwt.verify(token.replace('Bearer ', ''), SECRET);

    if (verified.userId && !verified._id) verified._id = verified.userId;
    if (verified._id && !verified.userId) verified.userId = verified._id;

    // ── AUTO-RECOVERY: Nếu User không tồn tại trong DB → tự tạo lại ────────
    // Xử lý zombie token (DB bị wipe nhưng user vẫn có JWT cũ)
    const User = require('../models/User');
    let existingUser = null;
    try {
      existingUser = await User.findById(verified.userId);
    } catch (e) { /* invalid ObjectId → bỏ qua */ }

    if (!existingUser) {
      // Tạo lại User với cùng _id từ JWT để token cũ tiếp tục dùng được
      try {
        const Agency = require('../models/Agency');
        
        // Thử tìm Agency từ agencyId cũ trong JWT (có thể đã bị xóa)
        let recoveredAgency = null;
        if (verified.agencyId) {
          recoveredAgency = await Agency.findById(verified.agencyId);
        }

        const recoveredId = new mongoose.Types.ObjectId(verified.userId);
        const shortId = String(verified.userId).slice(-6);
        
        existingUser = await User.create({
          _id: recoveredId,
          username: recoveredAgency?.name || `Cán bộ ${shortId}`,
          email: `recovered_${shortId}@webgov.local`,
          // Mật khẩu placeholder (không dùng được, cần Admin reset)
          password: `$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
          role: verified.role || 'COMMUNE_ADMIN',
          agencyId: recoveredAgency?._id || null,
          locationContext: { 
            province: 'Đắk Lắk', 
            commune: recoveredAgency?.name || '' 
          }
        });
        console.log(`[Auth] ⚡ AUTO-RECOVERY: Tái tạo user ${verified.userId} | agency: ${recoveredAgency?.name || 'null'}`);
        
        // Cập nhật lại agencyId nếu tìm thấy
        if (recoveredAgency) {
          verified.agencyId = recoveredAgency._id;
        }
      } catch (createErr) {
        // Có thể đã được tạo bởi request khác chạy đồng thời → findById lại
        try {
          existingUser = await User.findById(verified.userId);
        } catch (e) {}
        if (!existingUser) {
          console.log(`[Auth] ❌ Không thể phục hồi user ${verified.userId}: ${createErr.message}`);
          // Vẫn cho qua, controller sẽ xử lý tiếp
        }
      }
    }

    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};
