const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mammoth = require('mammoth');
const Document = require('../models/Document');
const Task = require('../models/Task');
const SharedFile = require('../models/SharedFile');
const ActivityLog = require('../models/ActivityLog');

// ============================================================
// HELPER: Đọc nội dung file (PDF, Word, Image)
// ============================================================
async function extractText(filePathOrUrl, mimeType) {
  try {
    if (!filePathOrUrl) return '';
    
    // Word (DOCX)
    if (mimeType?.includes('word') || filePathOrUrl.endsWith('.docx') || filePathOrUrl.endsWith('.doc')) {
      let buffer;
      if (filePathOrUrl.startsWith('http')) {
        const r = await axios.get(filePathOrUrl, { responseType: 'arraybuffer' });
        buffer = Buffer.from(r.data);
      } else {
        if (!fs.existsSync(filePathOrUrl)) return '';
        buffer = fs.readFileSync(filePathOrUrl);
      }
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }
    
    // PDF
    if (mimeType?.includes('pdf') || filePathOrUrl.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      let buffer;
      if (filePathOrUrl.startsWith('http')) {
        const r = await axios.get(filePathOrUrl, { responseType: 'arraybuffer' });
        buffer = Buffer.from(r.data);
      } else {
        if (!fs.existsSync(filePathOrUrl)) return '';
        buffer = fs.readFileSync(filePathOrUrl);
      }
      const data = await pdfParse(buffer);
      return data.text || '';
    }
    
    return '';
  } catch (err) {
    console.error('extractText error:', err.message);
    return '';
  }
}

// ============================================================
// HELPER: Gọi OpenAI (dùng chung)
// ============================================================
async function callOpenAI(systemPrompt, userPrompt, maxTokens = 4000) {
  const token = process.env.OPENAI_API_KEY;
  if (!token) throw new Error('Chưa cấu hình OPENAI_API_KEY');
  
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  return response.data.choices[0].message.content.trim();
}

// ============================================================
// HELPER: Lấy số liệu thống kê thực tế từ DB
// ============================================================
async function getSystemStats(agencyId, from, to) {
  const filter = {};
  if (agencyId) filter.agencyId = agencyId;
  if (from && to) {
    filter.createdAt = { $gte: new Date(from), $lte: new Date(to + 'T23:59:59.999Z') };
  }

  const [docsIncoming, docsOutgoing, tasksDone, tasksTotal, tasksOverdue, tasksInProgress] = await Promise.all([
    Document.countDocuments({ ...filter, type: 'INCOMING' }),
    Document.countDocuments({ ...filter, type: 'OUTGOING' }),
    Task.countDocuments({ ...filter, status: 'DONE' }),
    Task.countDocuments(filter),
    Task.countDocuments({ ...filter, status: 'OVERDUE' }),
    Task.countDocuments({ ...filter, status: 'IN_PROGRESS' }),
  ]);

  // Lấy danh sách VB + CV tiêu biểu
  const docs = await Document.find(filter).sort({ createdAt: -1 }).limit(30)
    .select('documentNumber issuingAgency summary category field urgency status type createdAt');
  const tasks = await Task.find(filter).sort({ createdAt: -1 }).limit(20)
    .select('title status priority createdAt');

  return {
    docsIncoming, docsOutgoing, docsTotal: docsIncoming + docsOutgoing,
    tasksDone, tasksTotal, tasksOverdue, tasksInProgress,
    docs, tasks,
  };
}

// ============================================================
// HELPER: Đọc file từ Drive theo thư mục
// ============================================================
async function getFilesFromDriveFolder(agencyId, folderName) {
  // Tìm thư mục theo tên
  const folder = await SharedFile.findOne({
    agencyId, isFolder: true, title: { $regex: folderName, $options: 'i' }
  });
  if (!folder) return [];
  
  // Lấy tất cả file trong thư mục
  const files = await SharedFile.find({ agencyId, parentId: folder._id, isFolder: false })
    .sort({ updatedAt: -1 });
  return files;
}

// ============================================================
// HELPER: Đọc nội dung nhiều file từ Drive
// ============================================================
async function readMultipleFiles(files, maxFiles = 5) {
  const contents = [];
  const filesToRead = files.slice(0, maxFiles);
  
  for (const f of filesToRead) {
    const filePath = f.currentFile?.filePath;
    const mimeType = f.currentFile?.mimeType;
    if (!filePath) continue;
    
    const text = await extractText(filePath, mimeType);
    if (text && text.trim().length > 10) {
      contents.push({
        title: f.title,
        content: text.substring(0, 5000), // Giới hạn 5000 ký tự mỗi file
      });
    }
  }
  return contents;
}

// ============================================================
// API 1: Lấy danh sách thư mục và file để hiển thị trên UI
// ============================================================
exports.getReportResources = async (req, res) => {
  try {
    const { agencyId } = req.user;
    if (!agencyId) return res.status(403).json({ message: 'Chưa có cơ quan' });

    // Lấy thư mục BÁO CÁO MẪU
    const templates = await getFilesFromDriveFolder(agencyId, 'BAO_CAO_MAU');
    
    // Lấy thư mục ĐỀ CƯƠNG
    const outlines = await getFilesFromDriveFolder(agencyId, 'DE_CUONG');

    res.json({
      templates: templates.map(f => ({ _id: f._id, title: f.title, mimeType: f.currentFile?.mimeType, updatedAt: f.updatedAt })),
      outlines: outlines.map(f => ({ _id: f._id, title: f.title, mimeType: f.currentFile?.mimeType, updatedAt: f.updatedAt })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tải tài nguyên báo cáo', error: err.message });
  }
};

// ============================================================
// API 2: AI TẠO BÁO CÁO 2.0 (Theo đề cương / báo cáo mẫu / tổng hợp)
// ============================================================
exports.generateReportV2 = async (req, res) => {
  try {
    const { agencyId } = req.user;
    if (!agencyId) return res.status(403).json({ message: 'Chưa có cơ quan' });

    const {
      mode,             // 'outline' | 'template' | 'synthesis'
      outlineFileId,    // ID file đề cương (mode outline)
      templateFileIds,  // Mảng ID file báo cáo mẫu (mode template)
      from, to,         // Khoảng thời gian
      userRequest,      // Yêu cầu người dùng (string)
      keywords,         // Từ khóa tìm kiếm VB liên quan
    } = req.body;

    if (!userRequest || userRequest.trim().length < 5) {
      return res.status(400).json({ message: 'Vui lòng nhập yêu cầu báo cáo' });
    }

    // ── 1. Đọc đề cương (nếu có) ──
    let outlineContent = '';
    if (outlineFileId) {
      const outlineFile = await SharedFile.findOne({ _id: outlineFileId, agencyId });
      if (outlineFile?.currentFile?.filePath) {
        outlineContent = await extractText(outlineFile.currentFile.filePath, outlineFile.currentFile.mimeType);
      }
    }

    // ── 2. Đọc báo cáo mẫu / báo cáo cũ (nếu có) ──
    let templateContents = [];
    if (templateFileIds && templateFileIds.length > 0) {
      const templateFiles = await SharedFile.find({ _id: { $in: templateFileIds }, agencyId });
      templateContents = await readMultipleFiles(templateFiles, 3);
    }

    // ── 3. Lấy số liệu thống kê thực tế từ DB ──
    const stats = await getSystemStats(agencyId, from, to);

    // ── 4. Tìm văn bản liên quan theo từ khóa ──
    let relatedDocs = [];
    const searchKeywords = keywords || userRequest;
    if (searchKeywords) {
      const keywordArray = searchKeywords.split(/[,\s]+/).filter(k => k.length > 1);
      if (keywordArray.length > 0) {
        const orConditions = keywordArray.map(kw => ({
          $or: [
            { summary: { $regex: kw, $options: 'i' } },
            { field: { $regex: kw, $options: 'i' } },
            { category: { $regex: kw, $options: 'i' } },
          ]
        }));
        const dateFilter = {};
        if (from && to) {
          dateFilter.createdAt = { $gte: new Date(from), $lte: new Date(to + 'T23:59:59.999Z') };
        }
        relatedDocs = await Document.find({
          agencyId,
          $or: orConditions.flatMap(c => c.$or),
          ...dateFilter,
        }).sort({ createdAt: -1 }).limit(20)
          .select('documentNumber summary field category status type urgency createdAt');
      }
    }

    // ── 5. Ghép context cho AI ──
    const periodLabel = from && to
      ? `${new Date(from).toLocaleDateString('vi-VN')} đến ${new Date(to).toLocaleDateString('vi-VN')}`
      : 'theo yêu cầu';

    let contextParts = [];

    // Đề cương
    if (outlineContent) {
      contextParts.push(`=== ĐỀ CƯƠNG BÁO CÁO (BẮT BUỘC TUÂN THỦ CẤU TRÚC NÀY) ===\n${outlineContent.substring(0, 6000)}`);
    }

    // Báo cáo mẫu
    if (templateContents.length > 0) {
      contextParts.push(`=== BÁO CÁO MẪU (HỌC VĂN PHONG, CÁCH TRÌNH BÀY, CÁCH NHẬN XÉT TỪ CÁC BÁO CÁO NÀY) ===`);
      for (const t of templateContents) {
        contextParts.push(`--- File: ${t.title} ---\n${t.content}`);
      }
    }

    // Số liệu thống kê
    contextParts.push(`=== SỐ LIỆU HỆ THỐNG (${periodLabel}) ===
- Văn bản đến: ${stats.docsIncoming}
- Văn bản đi: ${stats.docsOutgoing}
- Tổng cộng: ${stats.docsTotal}
- Công việc: Tổng ${stats.tasksTotal} | Hoàn thành: ${stats.tasksDone} (${stats.tasksTotal ? Math.round(stats.tasksDone / stats.tasksTotal * 100) : 0}%) | Đang thực hiện: ${stats.tasksInProgress} | Quá hạn: ${stats.tasksOverdue}`);

    // Danh sách VB tiêu biểu
    if (stats.docs.length > 0) {
      const docStr = stats.docs.map(d =>
        `  - [${d.type === 'INCOMING' ? 'Đến' : 'Đi'}] Số ${d.documentNumber || '?'} | ${d.issuingAgency || '?'} | ${d.summary || '?'} | ${d.field || '?'} | ${d.urgency || 'Thường'} | ${d.status}`
      ).join('\n');
      contextParts.push(`=== VĂN BẢN TIÊU BIỂU ===\n${docStr}`);
    }

    // VB liên quan theo keyword
    if (relatedDocs.length > 0) {
      const relStr = relatedDocs.map(d =>
        `  - [${d.type === 'INCOMING' ? 'Đến' : 'Đi'}] ${d.documentNumber || '?'} | ${d.summary || '?'} | ${d.field || '?'} | ${d.status}`
      ).join('\n');
      contextParts.push(`=== VĂN BẢN LIÊN QUAN ĐẾN CHỦ ĐỀ ===\n${relStr}`);
    }

    // Danh sách công việc tiêu biểu
    if (stats.tasks.length > 0) {
      const taskStr = stats.tasks.map(t => `  - [${t.status}] ${t.title} (${t.priority || '?'})`).join('\n');
      contextParts.push(`=== CÔNG VIỆC TIÊU BIỂU ===\n${taskStr}`);
    }

    const fullContext = contextParts.join('\n\n');

    // ── 6. System prompt mạnh ──
    const systemPrompt = `Bạn là Cán bộ Tham mưu Công an nhân dân / UBND cấp xã dày dặn kinh nghiệm, chuyên soạn thảo báo cáo công tác.

NGUYÊN TẮC BẮT BUỘC:
1. Nếu có ĐỀ CƯƠNG: PHẢI tuân thủ 100% cấu trúc đề cương. Giữ nguyên thứ tự, tên mục, số La Mã. KHÔNG tự chế bố cục.
2. Nếu có BÁO CÁO MẪU: Học văn phong, cách nhận xét, cách dùng từ, cách đánh giá từ báo cáo mẫu. Viết giống phong cách đó.
3. SỐ LIỆU: Chỉ dùng số liệu THỰC TẾ được cung cấp. KHÔNG bịa đặt. Nếu không có số liệu cụ thể cho mục nào, ghi "[Cần bổ sung số liệu]".
4. VĂN PHONG: Trang trọng, hành chính nhà nước. Ví dụ: "Đã tiếp nhận và xử lý 145/145 hồ sơ, đạt tỷ lệ 100%", KHÔNG viết chung chung kiểu "đạt nhiều kết quả tích cực".
5. SO SÁNH: Nếu có dữ liệu kỳ trước, tự tính tỷ lệ tăng/giảm.
6. TỒN TẠI: Nhận xét trung thực dựa trên số liệu (ví dụ: chỉ tiêu chưa đạt, quá hạn...).
7. Trả về Markdown rõ ràng, sạch sẽ.`;

    // ── 7. User prompt ──
    let userPrompt = `YÊU CẦU CỦA NGƯỜI DÙNG: ${userRequest}\n\nKỲ BÁO CÁO: ${periodLabel}\n\n${fullContext}`;

    if (mode === 'outline' && outlineContent) {
      userPrompt += `\n\n⚠️ QUAN TRỌNG: Bạn PHẢI viết báo cáo theo ĐÚNG cấu trúc đề cương đã cung cấp. Mỗi mục trong đề cương phải được điền đầy đủ nội dung dựa trên dữ liệu thực tế.`;
    } else if (mode === 'template' && templateContents.length > 0) {
      userPrompt += `\n\n⚠️ QUAN TRỌNG: Bạn PHẢI viết báo cáo theo ĐÚNG bố cục và văn phong của báo cáo mẫu. Cập nhật số liệu mới, nhận xét mới, nhưng GIỮ NGUYÊN cấu trúc trình bày.`;
    } else {
      userPrompt += `\n\n⚠️ QUAN TRỌNG: Tổng hợp tất cả dữ liệu liên quan và viết báo cáo hoàn chỉnh với cấu trúc: I. Đặc điểm tình hình, II. Kết quả thực hiện, III. Tồn tại/Hạn chế, IV. Phương hướng, V. Kiến nghị.`;
    }

    // ── 8. Gọi AI ──
    const reportContent = await callOpenAI(systemPrompt, userPrompt, 4000);

    // ── 9. Ghi nhật ký ──
    await ActivityLog.create({
      user: req.user.userId,
      action: 'AI_REPORT_V2',
      target: `Báo cáo (${mode}) - ${periodLabel}`,
      details: userRequest.substring(0, 200)
    });

    res.json({
      message: 'AI đã tạo báo cáo thành công',
      report: reportContent,
      stats: {
        docsIncoming: stats.docsIncoming,
        docsOutgoing: stats.docsOutgoing,
        docsTotal: stats.docsTotal,
        tasksTotal: stats.tasksTotal,
        tasksDone: stats.tasksDone,
        tasksOverdue: stats.tasksOverdue,
        periodLabel,
      },
      meta: {
        hasOutline: !!outlineContent,
        templateCount: templateContents.length,
        relatedDocsCount: relatedDocs.length,
        mode,
      }
    });

  } catch (err) {
    console.error('AI Report V2 error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Lỗi tạo báo cáo AI', error: err.message });
  }
};
