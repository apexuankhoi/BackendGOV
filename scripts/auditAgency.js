require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Agency = require('../models/Agency');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/webgov_daklak').then(async () => {
  const admins = await User.find({ role: { $in: ['PROVINCE_ADMIN', 'ADMIN', 'SENIOR_ADMIN'] } }).lean();
  console.log('=== ADMIN / PROVINCE USERS TO KEEP ===');
  admins.forEach(u => console.log(`  - ${u.username} | ${u.email} | ${u.role} | _id: ${u._id}`));

  const allAgencies = await Agency.find({ level: 'COMMUNE' }).sort({ name: 1 }).lean();
  console.log(`\n=== ALL COMMUNE AGENCIES (${allAgencies.length}) ===`);
  allAgencies.forEach((a, i) => console.log(`  ${i+1}. "${a.name}" | _id: ${a._id}`));

  process.exit(0);
});

