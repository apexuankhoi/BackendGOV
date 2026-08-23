const cron = require('node-cron');
const Document = require('../models/Document');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const { runBackup } = require('./backup');

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
  // ── Nhắc nhở deadline văn bản (07:00 hàng ngày) ─────────────────────────
  cron.schedule('0 7 * * *', () => {
    console.log('⏳ Đang chạy Cron Job nhắc nhở deadline...');
    sendDeadlineAlerts();
  });
  console.log('✅ Cron: Nhắc nhở deadline (07:00 hàng ngày)');

  // ── Backup tự động mỗi 12 giờ (01:00 và 13:00) ──────────────────────────
  cron.schedule('0 1,13 * * *', async () => {
    console.log('⏳ Cron Job: Bắt đầu backup tự động...');
    await runBackup();
  });
  console.log('✅ Cron: Backup tự động (01:00 và 13:00 hàng ngày)');

  // ── Chạy backup ngay khi server khởi động (lần đầu) ─────────────────────
  setTimeout(async () => {
    console.log('⏳ Chạy backup lần đầu sau khi server khởi động...');
    await runBackup();
  }, 10000); // Chờ 10 giây để DB kết nối xong
};

module.exports = { initCron };

