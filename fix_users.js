const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = require('./models/User');
  const Agency = require('./models/Agency');
  
  const users = await User.find({ role: { $ne: 'CITIZEN' } });
  const agencies = await Agency.find({ level: { $ne: 'PROVINCE' } });
  const provinceAgencies = await Agency.find({ level: 'PROVINCE' });
  
  let updated = 0;
  for (let u of users) {
     if (u.role === 'SENIOR_ADMIN' || u.role === 'ADMIN') {
        const daklak = provinceAgencies.find(a => a.name === 'Tỉnh Đắk Lắk');
        if (daklak) {
            u.agencyId = daklak._id;
            await u.save();
            updated++;
        }
     } else if (u.locationContext && u.locationContext.commune) {
        const c = u.locationContext.commune;
        const matched = agencies.find(a => c.includes(a.name) || a.name.includes(c));
        if (matched) {
          u.agencyId = matched._id;
          await u.save();
          updated++;
          console.log('Fixed ', u.username, ' -> ', matched.name);
        } else {
          console.log('No match found for: ', c);
        }
     }
  }
  console.log('Fixed ' + updated + ' users');
  process.exit(0);
}).catch(console.error);
