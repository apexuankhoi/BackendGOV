require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/webgov_daklak';

const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  agencyId: { type: mongoose.Schema.Types.ObjectId, default: null },
  role: { type: String, default: 'CITIZEN' },
  position: { type: String, default: null },
  department: { type: String, default: null },
  positionLabel: { type: String, default: '' },
  locationContext: { province: String, district: String, commune: String },
  avatar: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const leaders = [
  { username: 'Luong Minh Tung', email: 'luongminhtung.bithu@tinhdbdl.gov.vn', password: 'BithuDaklak@2026', role: 'SENIOR_ADMIN', position: 'BI_THU', positionLabel: 'Bi thu Tinh Doan' },
  { username: 'Nguyen Thao Giang', email: 'nguyenthaogiang.pbt@tinhdbdl.gov.vn', password: 'PhobithuDaklak@2026', role: 'PROVINCE_ADMIN', position: 'PHO_BI_THU', positionLabel: 'Pho Bi thu Tinh Doan' },
  { username: 'Y Le Pas Tor', email: 'ylepasstor.pbt@tinhdbdl.gov.vn', password: 'PhobithuDaklak@2026', role: 'PROVINCE_ADMIN', position: 'PHO_BI_THU', positionLabel: 'Pho Bi thu Tinh Doan' }
];

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected MongoDB!');
  for (const l of leaders) {
    const existing = await User.findOne({ email: l.email });
    if (existing) {
      existing.position = l.position;
      existing.positionLabel = l.positionLabel;
      existing.role = l.role;
      await existing.save();
      console.log('UPDATED: ' + l.username);
    } else {
      const hash = await bcrypt.hash(l.password, 10);
      await User.create(Object.assign({}, l, { password: hash, locationContext: { province: 'Dak Lak' } }));
      console.log('CREATED: ' + l.username + ' | ' + l.email + ' | PW: ' + l.password);
    }
  }
  await mongoose.disconnect();
  console.log('DONE!');
}
run().catch(function(e) { console.error(e); process.exit(1); });
