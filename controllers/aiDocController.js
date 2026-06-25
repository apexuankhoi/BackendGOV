const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Document = require('../models/Document');
const Task = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');
const mammoth = require('mammoth');

async function extractTextFromDocx(filePathOrUrl) {
  try {
    let buffer;
    if (filePathOrUrl.startsWith('http')) {
      const response = await axios.get(filePathOrUrl, { responseType: 'arraybuffer' });
      buffer = Buffer.from(response.data);
    } else {
      buffer = fs.readFileSync(filePathOrUrl);
    }
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (err) {
    if (err.message.includes('Can\'t find end of central directory') || filePathOrUrl.endsWith('.doc')) {
      throw new Error('AI hiện tại chỉ hỗ trợ định dạng Word mới (.docx). Vui lòng lưu lại file dưới dạng .docx rồi thử lại.');
    }
    console.error('Docx parse error:', err.message);
    throw new Error('Không thể đọc nội dung file Word. Vui lòng kiểm tra lại file.');
  }
}

// Hàm Helper để lấy text từ PDF (hỗ trợ cả file cục bộ và Cloudinary URL)
async function extractTextFromPDF(filePathOrUrl, publicId = null) {
  try {
    const pdfParse = require('pdf-parse');
    let buffer;
    if (filePathOrUrl.startsWith('http')) {
      let downloadUrl = filePathOrUrl;
      // Nếu có publicId, tạo Signed URL để lách luật chặn PDF của Cloudinary
      if (publicId) {
        const { cloudinary } = require('../config/cloudinary');
        downloadUrl = cloudinary.url(publicId, { sign_url: true, resource_type: 'image', format: 'pdf' });
      }
      const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
      buffer = Buffer.from(response.data);
    } else {
      buffer = fs.readFileSync(filePathOrUrl);
    }
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err) {
    console.error('PDF parse error:', err.message);
    return '';
  }
}

// Gọi OpenAI Model (Text Mode) - Hỗ trợ phong cách Tham Mưu Chuyên Sâu
async function callAIText(prompt) {
  const token = process.env.OPENAI_API_KEY;
  if (!token) return { error: 'Chưa cấu hình OPENAI_API_KEY.' };

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      messages: [
        {
          role: 'system',
          content: `Bạn là Cán bộ Tham mưu Công an nhân dân/UBND cấp xã dày dặn kinh nghiệm. 
Nhiệm vụ của bạn là đọc nội dung văn bản và trích xuất thông tin, đề xuất hướng xử lý với văn phong hành chính nhà nước, trang trọng, chính xác. 
Ví dụ: "Đề xuất đồng chí Trưởng Công an xã phân công CSKV rà soát...", "Kính báo cáo Thường trực Đảng ủy xem xét...".
Luôn trả lời JSON thuần túy (không bọc trong \`\`\`json).`
        },
        { role: 'user', content: prompt }
      ],
      model: 'gpt-4o-mini',
      temperature: 0.3,
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    let text = response.data.choices[0].message.content.trim();
    // Parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text);
  } catch (err) {
    return { error: 'Lỗi kết nối AI Text: ' + err.message };
  }
}

// Gọi OpenAI Model (Vision Mode) cho file ảnh (Ảnh scan/chụp)
async function callAIVision(imageUrl) {
  const token = process.env.OPENAI_API_KEY;
  if (!token) return { error: 'Chưa cấu hình OPENAI_API_KEY.' };

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Bạn là Cán bộ Tham mưu Công an nhân dân/UBND cấp xã. Dưới đây là ảnh chụp/scan của một văn bản hành chính.
Hãy đọc toàn bộ nội dung và trích xuất thành JSON thuần túy (không bọc trong \`\`\`json) với các trường:
{
  "soVanBan": "số văn bản (VD: 125/KH-CAX)",
  "loaiVanBan": "Công văn, Báo cáo, Kế hoạch, Tờ trình, Thông báo, Quyết định...",
  "ngayBanHanh": "DD/MM/YYYY",
  "coQuanBanHanh": "tên cơ quan",
  "nguoiKy": "họ tên",
  "chucVuNguoiKy": "chức vụ",
  "trichYeu": "trích yếu nội dung (1-2 câu)",
  "linhVuc": "lĩnh vực",
  "doKhan": "Thường/Khẩn/Thượng khẩn/Hỏa tốc",
  "hanXuLy": "DD/MM/YYYY hoặc null",
  "deXuatXuLy": "Đề xuất xử lý văn bản này (dùng văn phong Cán bộ Tham mưu, vd: 'Đề xuất Trưởng CAX giao CSKV...')",
  "congViecCanLam": ["Danh sách 1-3 công việc cụ thể cần làm (mảng string)"]
}` },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      model: 'gpt-4o-mini',
      max_tokens: 1500,
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    let text = response.data.choices[0].message.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text);
  } catch (err) {
    return { error: 'Lỗi kết nối AI Vision: ' + err.message };
  }
}

// API: AI đọc file đính kèm của văn bản (đã lưu database)
exports.aiReadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Document.findById(id);
    if (!doc) return res.status(404).json({ message: 'Không tìm thấy văn bản' });

    let textContent = '';
    let imageUrl = null;

    if (doc.attachments && doc.attachments.length > 0) {
      for (const att of doc.attachments) {
        if (att.mimeType === 'application/pdf') {
          textContent += await extractTextFromPDF(att.filePath);
        } else if (att.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || att.mimeType === 'application/msword') {
          try {
            textContent += await extractTextFromDocx(att.filePath);
          } catch (e) {
            return res.status(400).json({ message: e.message });
          }
        } else if (att.mimeType.startsWith('image/')) {
          imageUrl = att.filePath; // Lấy URL Cloudinary của ảnh
          break; // Ưu tiên đọc ảnh bằng Vision
        }
      }
    }

    let aiResult;
    
    // Nếu có ảnh, dùng Vision OCR trực tiếp
    if (imageUrl) {
      aiResult = await callAIVision(imageUrl);
    } else {
      // Nếu không có ảnh, dùng text từ PDF
      if (!textContent) textContent = [doc.summary, doc.notes].filter(Boolean).join('\n');
      if (!textContent || textContent.trim().length < 5) {
        return res.status(400).json({ message: 'PDF không có chữ (bản scan). Vui lòng upload file ảnh JPG/PNG để AI quét được.' });
      }
      const prompt = `Phân tích văn bản hành chính sau và trích xuất JSON thuần túy:
{
  "soVanBan": "số văn bản", "loaiVanBan": "loại", "ngayBanHanh": "DD/MM/YYYY", "coQuanBanHanh": "cơ quan",
  "nguoiKy": "họ tên", "chucVuNguoiKy": "chức vụ", "trichYeu": "trích yếu", "linhVuc": "lĩnh vực", "doKhan": "Thường/Khẩn/Hỏa tốc",
  "hanXuLy": "DD/MM/YYYY hoặc null", "deXuatXuLy": "Đề xuất tham mưu xử lý (văn phong CAND)", "congViecCanLam": ["việc 1"]
}
NỘI DUNG:
${textContent.substring(0, 4000)}`;
      aiResult = await callAIText(prompt);
    }

    if (aiResult.error) return res.status(500).json({ message: aiResult.error });

    doc.ocrContent = textContent ? textContent.substring(0, 5000) : 'Đã OCR từ ảnh bằng AI Vision.';
    doc.aiSuggestion = aiResult.deXuatXuLy || '';
    doc.aiExtracted = true;
    
    if (aiResult.soVanBan && !doc.documentNumber) doc.documentNumber = aiResult.soVanBan;
    if (aiResult.loaiVanBan) doc.category = aiResult.loaiVanBan;
    if (aiResult.coQuanBanHanh && !doc.issuingAgency) doc.issuingAgency = aiResult.coQuanBanHanh;
    if (aiResult.nguoiKy && !doc.signer) doc.signer = aiResult.nguoiKy;
    if (aiResult.trichYeu && !doc.summary) doc.summary = aiResult.trichYeu;

    await doc.save();
    
    await ActivityLog.create({
      user: req.user.userId,
      action: 'AI_READ_DOCUMENT',
      target: `${doc.documentNumber || doc._id}`,
      details: `AI trích xuất: ${aiResult.trichYeu || 'N/A'}`
    });

    res.json({ message: 'AI phân tích thành công', aiResult, document: doc, suggestedTasks: aiResult.congViecCanLam || [] });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// API: AI đọc file upload trực tiếp
exports.aiReadUpload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng upload file' });

    let aiResult;
    let textContent = '';

    if (req.file.mimetype.startsWith('image/')) {
      // Dùng Vision Mode
      aiResult = await callAIVision(req.file.path);
    } else if (req.file.mimetype === 'application/pdf') {
      // Dùng Text Mode
      textContent = await extractTextFromPDF(req.file.path, req.file.filename);
      if (!textContent || textContent.trim().length < 5) {
        // PDF Scan: Fallback to Vision Mode by requesting the .jpg version from Cloudinary
        const imageUrl = req.file.path.replace(/\.pdf$/i, '.jpg');
        aiResult = await callAIVision(imageUrl);
      } else {
        const prompt = `Phân tích văn bản hành chính sau và trích xuất JSON thuần túy:
{
  "soVanBan": "số văn bản", "loaiVanBan": "loại", "ngayBanHanh": "DD/MM/YYYY", "coQuanBanHanh": "cơ quan",
  "nguoiKy": "họ tên", "chucVuNguoiKy": "chức vụ", "trichYeu": "trích yếu", "linhVuc": "lĩnh vực", "doKhan": "Thường/Khẩn/Hỏa tốc",
  "hanXuLy": "DD/MM/YYYY hoặc null", "deXuatXuLy": "Đề xuất tham mưu xử lý (văn phong CAND)", "congViecCanLam": ["việc 1"]
}
NỘI DUNG:
${textContent.substring(0, 4000)}`;
        aiResult = await callAIText(prompt);
      }
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || req.file.mimetype === 'application/msword') {
      // Dùng Text Mode cho Word
      try {
        textContent = await extractTextFromDocx(req.file.path);
      } catch (e) {
        return res.status(400).json({ message: e.message });
      }
      if (!textContent || textContent.trim().length < 5) {
        return res.status(400).json({ message: 'File Word không có nội dung text hợp lệ.' });
      }
      const prompt = `Phân tích văn bản hành chính sau và trích xuất JSON thuần túy:
{
  "soVanBan": "số văn bản", "loaiVanBan": "loại", "ngayBanHanh": "DD/MM/YYYY", "coQuanBanHanh": "cơ quan",
  "nguoiKy": "họ tên", "chucVuNguoiKy": "chức vụ", "trichYeu": "trích yếu", "linhVuc": "lĩnh vực", "doKhan": "Thường/Khẩn/Hỏa tốc",
  "hanXuLy": "DD/MM/YYYY hoặc null", "deXuatXuLy": "Đề xuất tham mưu xử lý (văn phong CAND)", "congViecCanLam": ["việc 1"]
}
NỘI DUNG:
${textContent.substring(0, 4000)}`;
      aiResult = await callAIText(prompt);
    } else {
      return res.status(400).json({ message: 'Chỉ hỗ trợ PDF, Ảnh (JPG/PNG) và Word (DOC/DOCX)' });
    }

    if (aiResult && aiResult.error) return res.status(500).json({ message: aiResult.error });

    await ActivityLog.create({
      user: req.user.userId,
      action: 'AI_READ_UPLOAD',
      target: req.file.originalname,
      details: 'Sử dụng AI OCR thành công.'
    });

    res.json({
      message: 'AI phân tích thành công',
      aiResult,
      file: { originalName: req.file.originalname, filePath: req.file.path, mimeType: req.file.mimetype },
      ocrContent: textContent
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// API: AI tạo công việc từ mảng string
exports.aiCreateTasks = async (req, res) => {
  try {
    const { documentId, tasks: taskList } = req.body;
    if (!taskList || taskList.length === 0) return res.status(400).json({ message: 'Danh sách công việc trống' });

    const created = [];
    for (const t of taskList) {
      const task = await Task.create({
        title: t.title || t,
        assignedBy: req.user.userId,
        agencyId: req.user.agencyId || null,
        priority: 'Trung bình',
        sourceDocument: documentId || undefined,
        aiGenerated: true
      });
      created.push(task);
    }
    res.status(201).json({ message: `Đã tạo ${created.length} công việc từ AI`, tasks: created });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// API: AI giải quyết công việc
const { generateFileFromJSON } = require('../utils/aiFileGenerator');

exports.aiSolveTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id).populate('sourceDocument');
    if (!task) return res.status(404).json({ message: 'Không tìm thấy công việc' });

    let sourceContext = '';
    if (task.sourceDocument && task.sourceDocument.ocrContent) {
      sourceContext = `\n\nĐây là nội dung văn bản gốc liên quan:\n"""\n${task.sourceDocument.ocrContent.substring(0, 5000)}\n"""`;
    }

    const token = process.env.OPENAI_API_KEY;
    if (!token) return res.status(500).json({ message: 'Chưa cấu hình OPENAI_API_KEY' });

    const prompt = `Bạn là Chuyên viên xuất sắc trong cơ quan nhà nước.
Nhiệm vụ của bạn là GIẢI QUYẾT công việc sau đây một cách chi tiết, chuyên nghiệp.
Tên công việc: "${task.title}"
Mô tả công việc: "${task.description || 'Không có'}"${sourceContext}

Dựa vào các thông tin trên, hãy suy luận xem công việc này cần lập một TỜ TRÌNH, BÁO CÁO, KẾ HOẠCH, hay BẢNG DANH SÁCH (EXCEL).
Hãy ĐÓNG VAI người thực hiện và TRẢ VỀ DỮ LIỆU ĐỊNH DẠNG JSON CHUẨN XÁC để hệ thống tự động sinh file Word hoặc Excel.
BẮT BUỘC trả về đúng cấu trúc JSON sau (không markdown, không text dư thừa):
{
  "fileType": "docx" hoặc "xlsx",
  "documentMeta": {
    "agencyName": "ỦY BAN NHÂN DÂN",
    "title": "TÊN VĂN BẢN (VIẾT HOA)",
    "signer": "CHỦ TỊCH"
  },
  "contentBlocks": [
    { "type": "heading", "text": "I. NỘI DUNG CHÍNH" },
    { "type": "paragraph", "text": "Văn xuôi nội dung..." }
  ],
  "tableData": {
    "headers": ["STT", "Cột 1", "Cột 2"],
    "rows": [["1", "Giá trị 1", "Giá trị 2"]]
  }
}
Lưu ý: Nếu chọn fileType "docx", bạn PHẢI cung cấp contentBlocks. Nếu chọn "xlsx", bạn PHẢI cung cấp tableData.`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2500,
      temperature: 0.7,
      response_format: { type: "json_object" }
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const aiResponseText = response.data.choices[0].message.content.trim();
    let jsonData;
    try {
      jsonData = JSON.parse(aiResponseText);
    } catch (e) {
      return res.status(500).json({ message: 'Lỗi parse JSON từ AI', error: e.message });
    }
    
    // Lưu thông báo thân thiện (thay vì in nguyên mã JSON)
    task.aiSolution = "✅ **AI đã tự động soạn thảo file thành công!**\n\nVui lòng tải file đính kèm để xem chi tiết hoặc chuyển thành Văn bản đi.";
    
    // Sinh file vật lý
    const generatedFile = await generateFileFromJSON(jsonData, req.user, task._id.toString());
    
    task.aiGeneratedFiles.push(generatedFile);
    await task.save();

    res.json({ message: 'AI đã giải quyết và sinh file xong', task });
  } catch (err) {
    console.error('Lỗi AI Solve Task:', err.response?.data || err.message);
    res.status(500).json({ message: 'Lỗi AI giải quyết công việc', error: err.message });
  }
};

// API: AI Báo cáo (Tự viết Báo cáo công tác - có chọn khoảng thời gian)
exports.aiGenerateReport = async (req, res) => {
  try {
    const { from, to } = req.query;

    let startDate, endDate, periodLabel;
    if (from && to) {
      startDate = new Date(from);
      endDate   = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      periodLabel = `${new Date(from).toLocaleDateString('vi-VN')} đến ${new Date(to).toLocaleDateString('vi-VN')}`;
    } else {
      startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      endDate   = new Date();
      periodLabel = `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
    }

    const filter = { createdAt: { $gte: startDate, $lte: endDate } };
    if (req.user.agencyId) filter.agencyId = req.user.agencyId;

    const docsIncoming = await Document.countDocuments({ ...filter, type: 'INCOMING' });
    const docsOutgoing = await Document.countDocuments({ ...filter, type: 'OUTGOING' });
    const docsTotal    = docsIncoming + docsOutgoing;
    const tasksTotal   = await Task.countDocuments(filter);
    const tasksDone    = await Task.countDocuments({ ...filter, status: 'DONE' });
    const tasksOverdue = await Task.countDocuments({ ...filter, status: 'OVERDUE' });
    const tasksInProg  = await Task.countDocuments({ ...filter, status: 'IN_PROGRESS' });

    const docList = await Document.find(filter).sort({ createdAt: -1 }).limit(15)
      .select('documentNumber issuingAgency summary category urgency status type');
    const docListStr = docList.map(d =>
      `- [${d.type === 'INCOMING' ? 'Đến' : 'Đi'}] Số ${d.documentNumber || '?'} | ${d.issuingAgency || '?'} | ${d.summary || '?'} | ${d.urgency || 'Thường'} | ${d.status}`
    ).join('\n');

    const tasksList = await Task.find(filter).sort({ createdAt: -1 }).limit(20).select('title status priority');
    const tasksStr  = tasksList.map(t => `- [${t.status}] ${t.title} (${t.priority || '?'})`).join('\n');

    const prompt = `Bạn là Cán bộ Tham mưu Công an nhân dân/UBND cấp xã dày dặn kinh nghiệm. 
Hãy soạn thảo "Báo cáo công tác" cho kỳ ${periodLabel}, dựa trên số liệu thực tế sau (KHÔNG bịa đặt):

=== SỐ LIỆU VĂN BẢN ===
- Văn bản đến: ${docsIncoming}
- Văn bản đi: ${docsOutgoing}
- Tổng cộng: ${docsTotal}

=== SỐ LIỆU CÔNG VIỆC ===
- Tổng: ${tasksTotal} | Hoàn thành: ${tasksDone} (${tasksTotal ? Math.round(tasksDone/tasksTotal*100) : 0}%) | Đang thực hiện: ${tasksInProg} | Quá hạn: ${tasksOverdue}

=== VĂN BẢN TIÊU BIỂU ===
${docListStr || 'Không có'}

=== CÔNG VIỆC TIÊU BIỂU ===
${tasksStr || 'Không có'}

Hãy viết báo cáo theo cấu trúc Markdown đẹp, đúng văn phong hành chính nhà nước/CAND:

# BÁO CÁO CÔNG TÁC ${periodLabel.toUpperCase()}

**I. TÌNH HÌNH CHUNG**
**II. KẾT QUẢ ĐẠT ĐƯỢC**
**III. TỒN TẠI, HẠN CHẾ**
**IV. PHƯƠNG HƯỚNG NHIỆM VỤ KỲ TỚI**
**V. ĐỀ XUẤT, KIẾN NGHỊ**`;

    const token = process.env.OPENAI_API_KEY;
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 2500,
    }, { headers: { 'Authorization': `Bearer ${token}` } });

    const reportContent = response.data.choices[0].message.content;

    await ActivityLog.create({
      user: req.user.userId,
      action: 'AI_GENERATE_REPORT',
      target: `Báo cáo ${periodLabel}`,
      details: `${docsTotal} văn bản, ${tasksTotal} công việc`
    });

    res.json({
      message: 'Tạo báo cáo thành công',
      report: reportContent,
      stats: { docsIncoming, docsOutgoing, docsTotal, tasksTotal, tasksDone, tasksOverdue, tasksInProg, periodLabel }
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// API: Lấy văn bản sắp đến hạn / quá hạn
exports.getDeadlineAlerts = async (req, res) => {
  try {
    const now     = new Date();
    const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const scope = req.user.agencyId ? { agencyId: req.user.agencyId } : {};

    const alerts  = await Document.find({
      ...scope,
      deadline: { $gte: now, $lte: in3days },
      status: { $nin: ['Hoàn thành'] }
    }).sort({ deadline: 1 }).limit(20)
      .select('documentNumber summary deadline status urgency issuingAgency type');

    const overdue = await Document.find({
      ...scope,
      deadline: { $lt: now },
      status: { $nin: ['Hoàn thành'] }
    }).sort({ deadline: -1 }).limit(20)
      .select('documentNumber summary deadline status urgency issuingAgency type');

    res.json({ alerts, overdue, total: alerts.length + overdue.length });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
