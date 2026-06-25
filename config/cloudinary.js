const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Cấu hình Cloudinary credentials (Lấy từ .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || '123456789012345',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'xxxxxxxxxxxxxxxxxxxxxx',
  timeout: 600000, // Tăng timeout lên 10 phút (600,000ms) để tránh lỗi 499 Request Timeout
});

// Cấu hình Storage cho Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Lấy tên file gốc (Bỏ dấu tiếng Việt, thay khoảng trắng thành gạch dưới để Cloudinary không lỗi)
    let originalName = file.originalname || 'file_khong_ten';
    // Chuyển tiếng Việt không dấu và thay ký tự đặc biệt
    originalName = originalName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.-]/g, "_");

    return {
      folder: process.env.CLOUDINARY_FOLDER || 'webgov_daklak',
      resource_type: 'raw',
      public_id: `${Date.now()}_${originalName}` // Thêm Date.now để không bị trùng tên file
    };
  },
});

const uploadCloudinary = multer({ storage: storage });

module.exports = { cloudinary, uploadCloudinary };
