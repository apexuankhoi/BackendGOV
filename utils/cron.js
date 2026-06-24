const cron = require('node-cron');
const Document = require('../models/Document');
const User = require('../models/User');
const nodemailer = require('nodemailer');

const sendDeadlineAlerts = async () => {
  try {
    const now = new Date();
    const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const alerts = await Document.find({
      deadline: { $gte: now, $lte: in3days },
      status: { $nin: ['Hoàn thành'] }
    });

    const overdue = await Document.find({
      deadline: { $lt: now },
      status: { $nin: ['Hoàn thành'] }
    });

    if (alerts.length === 0 && overdue.length === 0) return;

    const admins = await User.find({ role: { $in: ['ADMIN', 'SENIOR_ADMIN', 'COMMUNE_ADMIN', 'PROVINCE_ADMIN'] } });
    if (admins.length === 0) return;

    let htmlContent = `<h2>📢 Cảnh báo Hạn xử lý Văn bản</h2>`;
    
    if (overdue.length > 0) {
      htmlContent += `<h3 style="color: red;">🔴 VĂN BẢN ĐÃ QUÁ HẠN (${overdue.length})</h3><ul>`;
      overdue.forEach(doc => {
        htmlContent += `<li><strong>Số ${doc.documentNumber || '?'}</strong> (${doc.issuingAgency}): ${doc.summary} - Hạn: ${new Date(doc.deadline).toLocaleDateString('vi-VN')}</li>`;
      });
      htmlContent += `</ul>`;
    }

    if (alerts.length > 0) {
      htmlContent += `<h3 style="color: orange;">🟡 VĂN BẢN SẮP ĐẾN HẠN TRONG 3 NGÀY (${alerts.length})</h3><ul>`;
      alerts.forEach(doc => {
        htmlContent += `<li><strong>Số ${doc.documentNumber || '?'}</strong> (${doc.issuingAgency}): ${doc.summary} - Hạn: ${new Date(doc.deadline).toLocaleDateString('vi-VN')}</li>`;
      });
      htmlContent += `</ul>`;
    }

    htmlContent += `<p>Vui lòng đăng nhập hệ thống Webgov để xử lý.</p>`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const emails = admins.map(a => a.email).filter(e => e);
    if (emails.length === 0) return;

    await transporter.sendMail({
      from: '"Webgov E-Office" <' + process.env.EMAIL_USER + '>',
      to: emails.join(','),
      subject: `[Webgov] Cảnh báo Hạn xử lý Văn bản - ${new Date().toLocaleDateString('vi-VN')}`,
      html: htmlContent
    });

    console.log(`✅ Đã gửi email nhắc nhở deadline tới ${emails.length} người.`);
  } catch (err) {
    console.error('❌ Lỗi chạy cron nhắc nhở:', err.message);
  }
};

const initCron = () => {
  cron.schedule('0 7 * * *', () => {
    console.log('⏳ Đang chạy Cron Job nhắc nhở deadline...');
    sendDeadlineAlerts();
  });
  console.log('✅ Đã khởi tạo Cron Job nhắc nhở (07:00 AM hàng ngày).');
};

module.exports = { initCron };
