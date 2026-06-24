const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Cấu hình Cloudinary credentials (Lấy từ .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || '123456789012345',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'xxxxxxxxxxxxxxxxxxxxxx',
});

// Cấu hình Storage cho Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: process.env.CLOUDINARY_FOLDER || 'webgov_daklak', // Tên thư mục trên Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf', 'doc', 'docx'],
    resource_type: 'auto', // Cần thiết để upload doc, docx, pdf
  },
});

const uploadCloudinary = multer({ storage: storage });

module.exports = { cloudinary, uploadCloudinary };
