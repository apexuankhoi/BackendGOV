const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'webgov_secret_key_12345';

const axios = require('axios');

exports.ekycCitizen = async (req, res) => {
  try {
    const { frontImage, backImage } = req.body;
    if (!frontImage) return res.status(400).json({ message: 'Thiếu ảnh mặt trước CCCD' });

    const token = process.env.OPENAI_API_KEY;
    if (!token) return res.status(500).json({ message: 'Chưa cấu hình OPENAI_API_KEY' });

    // Ensure it's a valid base64 data URI format. If it is already one, great.
    // Assuming frontend sends the full data URI: data:image/jpeg;base64,...
    const imageUrl = frontImage.startsWith('data:') ? frontImage : `data:image/jpeg;base64,${frontImage}`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Bạn là một hệ thống eKYC chuyên nghiệp. Hãy đọc thẻ CCCD trong ảnh này và trích xuất thông tin. Trả về đúng định dạng JSON (không dùng markdown code blocks) với các trường: "cccd", "fullName", "dob", "address". Nếu không đọc được hoặc không phải CCCD hợp lệ, trả về { "error": "Ảnh không hợp lệ" }.' },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 300,
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const aiText = response.data.choices[0].message.content.trim();
    const result = JSON.parse(aiText);

    if (result.error) return res.status(400).json({ message: result.error });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi quét CCCD', error: err.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, role, province, district, commune, theNganhImage, cccd, dob, address } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email đã tồn tại' });

    // Logic kiểm duyệt Thẻ Ngành cho Cán bộ bằng AI
    if (role === 'COMMUNE_ADMIN' || role === 'PROVINCE_ADMIN') {
      if (!theNganhImage) return res.status(400).json({ message: 'Vui lòng cung cấp ảnh Thẻ Ngành/Thẻ Cán bộ.' });
      const token = process.env.OPENAI_API_KEY;
      if (!token) return res.status(500).json({ message: 'Hệ thống chưa cấu hình AI.' });

      const imageUrl = theNganhImage.startsWith('data:') ? theNganhImage : `data:image/jpeg;base64,${theNganhImage}`;
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `Bạn là Thanh tra Nhân sự. Đây là ảnh thẻ cán bộ. Người dùng khai báo tên là "${username}" và đơn vị công tác là "${commune}". Hãy kiểm tra: 1. Có đúng là thẻ cán bộ/thẻ ngành/QĐ bổ nhiệm không? 2. Có chữ nào tương đồng với tên "${username}" không? 3. Có liên quan đến địa phương "${commune}" không? Trả về JSON thuần túy (không markdown): {"approved": true/false, "reason": "lý do chi tiết"}` },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 200,
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const aiResult = JSON.parse(response.data.choices[0].message.content.trim());
      if (!aiResult.approved) {
        return res.status(400).json({ message: `Hệ thống AI từ chối: ${aiResult.reason}` });
      }
    }

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ 
      username, 
      email, 
      password: hashed, 
      role: role || 'CITIZEN', 
      locationContext: { province, district, commune },
      cccd, dob, address
    });
    res.status(201).json({ message: 'Đăng ký thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Sai email hoặc mật khẩu' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Sai email hoặc mật khẩu' });
    const token = jwt.sign({ userId: user._id, role: user.role }, SECRET, { expiresIn: '15m' }); // Token sống 15 phút
    const refreshToken = jwt.sign({ userId: user._id, role: user.role }, SECRET, { expiresIn: '7d' }); // Refresh sống 7 ngày
    res.json({ token, refreshToken, role: user.role, username: user.username });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'Token is required' });
    
    jwt.verify(refreshToken, SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ message: 'Invalid refresh token' });
      
      const newToken = jwt.sign({ userId: decoded.userId, role: decoded.role }, SECRET, { expiresIn: '15m' });
      res.json({ token: newToken });
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
