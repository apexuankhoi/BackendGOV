const jwt = require('jsonwebtoken');

// ── Thời điểm server khởi động (Unix timestamp, giây) ──────────────────────
// Mọi token được cấp TRƯỚC thời điểm này đều bị coi là hết hạn → buộc login lại
const SERVER_BOOT_TIME = Math.floor(Date.now() / 1000);
console.log(`[Auth] Server boot time: ${new Date(SERVER_BOOT_TIME * 1000).toLocaleString('vi-VN')} | Mọi token cũ hơn đều bị vô hiệu.`);

module.exports = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'Truy cập bị từ chối' });

  try {
    const verified = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'webgov_secret_key_12345');

    // ── Buộc đăng nhập lại nếu token được cấp trước lúc server khởi động ──
    if (verified.iat && verified.iat < SERVER_BOOT_TIME) {
      return res.status(401).json({ 
        message: 'Phiên đăng nhập đã hết hạn do hệ thống được cập nhật. Vui lòng đăng nhập lại.',
        code: 'SERVER_RESTARTED'
      });
    }

    if (verified.userId && !verified._id) verified._id = verified.userId;
    if (verified._id && !verified.userId) verified.userId = verified._id;
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};
