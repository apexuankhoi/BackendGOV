require('dotenv').config();
const mongoose = require('mongoose');
const Agency = require('./models/Agency');
const User = require('./models/User');
const Document = require('./models/Document');
const Task = require('./models/Task');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Tao 1 Tinh
    let tinh = await Agency.findOne({ name: 'Tỉnh Đắk Lắk' });
    if (!tinh) {
      tinh = await Agency.create({ name: 'Tỉnh Đắk Lắk', level: 'PROVINCE' });
    }

    // Tao 1 Xa
    let phuong = await Agency.findOne({ name: 'Phường Ea Tam' });
    if (!phuong) {
      phuong = await Agency.create({ name: 'Phường Ea Tam', level: 'COMMUNE', parentAgency: tinh._id });
    }

    console.log('Agencies created/found');

    // Update existing data to default to Tinh
    const usersRes = await User.updateMany({ agencyId: null }, { agencyId: tinh._id });
    console.log('Updated Users:', usersRes.modifiedCount);

    const docsRes = await Document.updateMany({ agencyId: null }, { agencyId: tinh._id });
    console.log('Updated Documents:', docsRes.modifiedCount);

    const tasksRes = await Task.updateMany({ agencyId: null }, { agencyId: tinh._id });
    console.log('Updated Tasks:', tasksRes.modifiedCount);

    console.log('Done migration!');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

seed();
