const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Document = require('../models/Document');
const Task = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');

// Đọc text từ PDF
async function extractTextFromPDF(filePath) {
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err) {
    console.error('PDF parse error:', err.message);
    return '';
  }
}

// Gọi OpenAI Model để phân tích văn bản
async function callAI(prompt) {
  const token = process.env.OPENAI_API_KEY;
  if (!token) {
    return { error: 'Chưa cấu hình OPENAI_API_KEY. Vui lòng liên hệ Admin.' };
  }

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      messages: [
        {
          role: 'system',
          content: `Bạn là trợ lý AI chuyên phân tích văn bản hành chính Việt Nam. 
Nhiệm vụ: đọc nội dung văn bản và trích xuất thông tin chính xác.
Luôn trả lời bằng JSON hợp lệ, không kèm markdown hay giải thích.`
        },
        { role: 'user', content: prompt }
      ],
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 2000
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const text = response.data.choices[0].message.content;
    // Cố gắng parse JSON từ response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { rawResponse: text };
  } catch (err) {
    console.error('AI API Error:', err.response?.data || err.message);
    return { error: 'Lỗi kết nối AI: ' + (err.response?.data?.error?.message || err.message) };
  }
}

// API: AI đọc file đính kèm của văn bản
exports.aiReadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Document.findById(id);
    if (!doc) return res.status(404).json({ message: 'Không tìm thấy văn bản' });

    let textContent = '';

    // Nếu có file PDF đính kèm, đọc text từ PDF
    if (doc.attachments && doc.attachments.length > 0) {
      for (const att of doc.attachments) {
        if (att.mimeType === 'application/pdf') {
          const fullPath = path.resolve(att.filePath);
          if (fs.existsSync(fullPath)) {
            textContent += await extractTextFromPDF(fullPath);
          }
        }
      }
    }

    // Nếu có nội dung OCR sẵn thì dùng
    if (!textContent && doc.ocrContent) {
      textContent = doc.ocrContent;
    }

    // Nếu có summary/notes thì dùng
    if (!textContent) {
      textContent = [doc.summary, doc.notes].filter(Boolean).join('\n');
    }

    if (!textContent || textContent.trim().length < 10) {
      return res.status(400).json({
        message: 'Không đọc được nội dung từ file. Vui lòng upload file PDF có text (không phải ảnh scan).'
      });
    }

    // Gửi AI phân tích
    const prompt = `Phân tích văn bản hành chính sau và trích xuất thông tin. Trả lời bằng JSON với các trường:
{
  "soVanBan": "số văn bản (VD: 125/KH-CAX)",
  "loaiVanBan": "một trong: Công văn, Báo cáo, Kế hoạch, Tờ trình, Thông báo, Quyết định, Giấy mời, Chỉ thị, Hướng dẫn, Khác",
  "ngayBanHanh": "ngày ban hành (DD/MM/YYYY)",
  "coQuanBanHanh": "tên cơ quan ban hành",
  "nguoiKy": "họ tên người ký",
  "chucVuNguoiKy": "chức vụ người ký",
  "trichYeu": "trích yếu nội dung (1-2 câu)",
  "linhVuc": "lĩnh vực (VD: An ninh trật tự, Cư trú, Phòng cháy, Hành chính...)",
  "doKhan": "một trong: Thường, Khẩn, Thượng khẩn, Hỏa tốc",
  "hanXuLy": "hạn xử lý nếu có (DD/MM/YYYY) hoặc null",
  "deXuatXuLy": "đề xuất cách xử lý văn bản này (1-2 câu)",
  "congViecCanLam": "danh sách công việc cần làm từ văn bản này (mảng string)"
}

NỘI DUNG VĂN BẢN:
${textContent.substring(0, 4000)}`;

    const aiResult = await callAI(prompt);

    if (aiResult.error) {
      return res.status(500).json({ message: aiResult.error });
    }

    // Lưu nội dung OCR và kết quả AI
    doc.ocrContent = textContent.substring(0, 10000);
    doc.aiSuggestion = aiResult.deXuatXuLy || '';
    doc.aiExtracted = true;

    // Auto-fill các trường từ AI
    if (aiResult.soVanBan && !doc.documentNumber) doc.documentNumber = aiResult.soVanBan;
    if (aiResult.loaiVanBan) doc.category = aiResult.loaiVanBan;
    if (aiResult.coQuanBanHanh && !doc.issuingAgency) doc.issuingAgency = aiResult.coQuanBanHanh;
    if (aiResult.nguoiKy && !doc.signer) doc.signer = aiResult.nguoiKy;
    if (aiResult.chucVuNguoiKy) doc.signerTitle = aiResult.chucVuNguoiKy;
    if (aiResult.trichYeu && !doc.summary) doc.summary = aiResult.trichYeu;
    if (aiResult.linhVuc) doc.field = aiResult.linhVuc;
    if (aiResult.doKhan) doc.urgency = aiResult.doKhan;
    if (aiResult.ngayBanHanh) {
      const parts = aiResult.ngayBanHanh.split('/');
      if (parts.length === 3) doc.issuedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    if (aiResult.hanXuLy) {
      const parts = aiResult.hanXuLy.split('/');
      if (parts.length === 3) doc.deadline = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }

    await doc.save();

    // Ghi nhật ký
    await ActivityLog.create({
      user: req.user.userId,
      action: 'AI_READ_DOCUMENT',
      target: `${doc.type === 'INCOMING' ? 'VB Đến' : 'VB Đi'} #${doc.documentNumber || doc._id}`,
      details: `AI trích xuất: ${aiResult.trichYeu || 'N/A'}`
    });

    res.json({
      message: 'AI đã phân tích văn bản thành công',
      aiResult,
      document: doc,
      suggestedTasks: aiResult.congViecCanLam || []
    });
  } catch (err) {
    console.error('AI Read Error:', err);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// API: AI đọc file upload trực tiếp (không cần tạo văn bản trước)
exports.aiReadUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng upload file PDF' });
    }

    let textContent = '';
    if (req.file.mimetype === 'application/pdf') {
      textContent = await extractTextFromPDF(req.file.path);
    }

    if (!textContent || textContent.trim().length < 10) {
      // Cleanup file
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      return res.status(400).json({
        message: 'Không đọc được nội dung từ file. File có thể là ảnh scan — cần OCR. Vui lòng upload PDF có text.'
      });
    }

    const prompt = `Phân tích văn bản hành chính sau và trích xuất thông tin. Trả lời bằng JSON:
{
  "soVanBan": "số văn bản",
  "loaiVanBan": "một trong: Công văn, Báo cáo, Kế hoạch, Tờ trình, Thông báo, Quyết định, Giấy mời, Chỉ thị, Hướng dẫn, Khác",
  "ngayBanHanh": "DD/MM/YYYY",
  "coQuanBanHanh": "tên cơ quan",
  "nguoiKy": "họ tên",
  "chucVuNguoiKy": "chức vụ",
  "trichYeu": "trích yếu (1-2 câu)",
  "linhVuc": "lĩnh vực",
  "doKhan": "Thường/Khẩn/Thượng khẩn/Hỏa tốc",
  "hanXuLy": "DD/MM/YYYY hoặc null",
  "deXuatXuLy": "đề xuất xử lý",
  "congViecCanLam": ["công việc 1", "công việc 2"]
}

NỘI DUNG:
${textContent.substring(0, 4000)}`;

    const aiResult = await callAI(prompt);

    // Ghi nhật ký
    await ActivityLog.create({
      user: req.user.userId,
      action: 'AI_READ_UPLOAD',
      target: req.file.originalname,
      details: `AI trích xuất: ${aiResult.trichYeu || 'N/A'}`
    });

    res.json({
      message: 'AI đã phân tích file thành công',
      aiResult,
      file: {
        originalName: req.file.originalname,
        fileName: req.file.filename,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      },
      ocrContent: textContent.substring(0, 5000)
    });
  } catch (err) {
    console.error('AI Upload Read Error:', err);
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// API: AI tạo công việc từ văn bản
exports.aiCreateTasks = async (req, res) => {
  try {
    const { documentId, tasks: taskList } = req.body;
    if (!taskList || !Array.isArray(taskList) || taskList.length === 0) {
      return res.status(400).json({ message: 'Danh sách công việc trống' });
    }

    const created = [];
    for (const t of taskList) {
      const task = await Task.create({
        title: t.title || t,
        description: t.description || '',
        assignedBy: req.user.userId,
        assignedTo: t.assignedTo || undefined,
        deadline: t.deadline || undefined,
        priority: t.priority || 'Trung bình',
        sourceDocument: documentId || undefined,
        aiGenerated: true
      });
      created.push(task);
    }

    await ActivityLog.create({
      user: req.user.userId,
      action: 'AI_CREATE_TASKS',
      target: `${created.length} công việc từ AI`,
      details: created.map(t => t.title).join(', ')
    });

    res.status(201).json({ message: `Đã tạo ${created.length} công việc từ AI`, tasks: created });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
