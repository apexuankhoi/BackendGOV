const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Agency = require('./models/Agency');

dotenv.config();

const PROVINCES_DATA = {
  "Đắk Lắk": [
    "Phường Buôn Ma Thuột", "Phường Tân An", "Phường Tân Lập", "Phường Thành Nhất", "Phường Ea Kao", "Xã Hòa Phú",
    "Phường Buôn Hồ", "Phường Cư Bao", "Xã Ea Drông",
    "Xã Ea Súp", "Xã Ea Rốk", "Xã Ea Bung", "Xã Ia Rvê", "Xã Ia Lốp", "Xã Ea Wer", "Xã Ea Nuôl", "Xã Buôn Đôn",
    "Xã Ea Kiết", "Xã Ea M'Droh", "Xã Quảng Phú", "Xã Cuôr Đăng", "Xã Cư M'gar", "Xã Ea Tul",
    "Xã Pơng Drang", "Xã Krông Búk", "Xã Cư Pơng",
    "Xã Ea Khal", "Xã Ea Drăng", "Xã Ea Wy", "Xã Ea H'Leo", "Xã Ea Hiao",
    "Xã Krông Năng", "Xã Dliê Ya", "Xã Tam Giang", "Xã Phú Xuân",
    "Xã Krông Pắc", "Xã Ea Knuếc", "Xã Tân Tiến", "Xã Ea Phê", "Xã Ea Kly", "Xã Vụ Bổn",
    "Xã Ea Kar", "Xã Ea Ô", "Xã Ea Knốp", "Xã Cư Yang", "Xã Ea Păl",
    "Xã M'Drắk", "Xã Ea Riêng", "Xã Cư M'ta", "Xã Krông Á", "Xã Cư Prao", "Xã Ea Trang",
    "Xã Hòa Sơn", "Xã Dang Kang", "Xã Krông Bông", "Xã Yang Mao", "Xã Cư Pui",
    "Xã Liên Sơn Lắk", "Xã Đắk Liêng", "Xã Nam Ka", "Xã Đắk Phơi",
    "Xã Krông Nô", "Xã Ea Ning", "Xã Dray Bhăng", "Xã Ea Ktur", "Xã Krông Ana", "Xã Dur Kmăl", "Xã Ea Na",
    "Đoàn phường Tuy Hòa", "Đoàn phường Phú Yên", "Đoàn phường Bình Kiến", "Đoàn phường Xuân Đài", "Đoàn phường Sông Cầu",
    "Đoàn xã Xuân Thọ", "Đoàn xã Xuân Cảnh", "Đoàn xã Xuân Lộc",
    "Đoàn phường Đông Hòa", "Đoàn phường Hòa Hiệp", "Đoàn xã Hòa Xuân",
    "Đoàn xã Tuy An Bắc", "Đoàn xã Tuy An Đông", "Đoàn xã Ô Loan", "Đoàn xã Tuy An Nam", "Đoàn xã Tuy An Tây",
    "Đoàn xã Phú Hòa 1", "Đoàn xã Phú Hòa 2", "Đoàn xã Hòa Thịnh", "Đoàn xã Hòa Mỹ",
    "Đoàn xã Tây Hòa", "Đoàn xã Sơn Thành", "Đoàn xã Sơn Hòa", "Đoàn xã Vân Hòa", "Đoàn xã Tây Sơn", "Đoàn xã Suối Trai",
    "Đoàn xã Ea Ly", "Đoàn xã Ea Bá", "Đoàn xã Đức Bình", "Đoàn xã Sông Hinh",
    "Đoàn xã Xuân Lãnh", "Đoàn xã Phú Mỡ", "Đoàn xã Xuân Phước", "Đoàn xã Đồng Xuân"
  ]
};

async function seedData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối DB');

    // Xóa tất cả Agency cũ
    await Agency.deleteMany({});
    console.log('Đã xóa dữ liệu Agency cũ');

    for (const [provinceName, communes] of Object.entries(PROVINCES_DATA)) {
      // 1. Tạo Tỉnh
      const province = await Agency.create({
        name: `Tỉnh ${provinceName}`,
        level: 'PROVINCE',
        description: `Cấp Tỉnh - ${provinceName}`
      });
      console.log(`Đã tạo Tỉnh: ${province.name}`);

      // 2. Tạo các Xã thuộc Tỉnh
      const communeDocs = communes.map(communeName => ({
        name: `${communeName}`,
        level: 'COMMUNE',
        parentAgency: province._id,
        description: `Cấp Xã/Phường - ${communeName}`
      }));
      
      await Agency.insertMany(communeDocs);
      console.log(`Đã tạo ${communeDocs.length} Xã/Phường thuộc ${provinceName}`);
    }

    console.log('🎉 Seeding hoàn tất!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  }
}

seedData();
