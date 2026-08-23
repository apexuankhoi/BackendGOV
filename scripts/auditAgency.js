require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Agency = require('../models/Agency');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/webgov_daklak').then(async () => {
  const total = await User.countDocuments();
  const noAgency = await User.countDocuments({ agencyId: null });
  const noAgencyWithCommune = await User.countDocuments({ agencyId: null, 'locationContext.commune': { $exists: true, $ne: '' } });
  
  // Check dead agencyId refs (agencyId set but Agency doesn't exist)
  const allUsers = await User.find({ agencyId: { $ne: null } }).lean();
  let dead = [];
  for (const u of allUsers) {
    const ag = await Agency.findById(u.agencyId);
    if (!ag) dead.push({ email: u.email, role: u.role, agencyId: u.agencyId, commune: u.locationContext?.commune });
  }
  
  const roles = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
  
  console.log('=== KIỂM TRA TỔNG THỂ USER ===');
  console.log('Total users:', total);
  console.log('No agencyId:', noAgency);
  console.log('No agencyId nhưng có commune:', noAgencyWithCommune);
  console.log('Dead agencyId refs:', dead.length);
  if (dead.length > 0) {
    dead.forEach(u => console.log('  -', u.email, '|', u.role, '| commune:', u.commune));
  }
  console.log('\nRoles:');
  roles.forEach(r => console.log(`  ${r._id}: ${r.count}`));
  process.exit(0);
});
