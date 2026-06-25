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
    return {
      folder: process.env.CLOUDINARY_FOLDER || 'webgov_daklak',
      resource_type: 'raw'
    };
  },
});

const uploadCloudinary = multer({ storage: storage });

module.exports = { cloudinary, uploadCloudinary };
