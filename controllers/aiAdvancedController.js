const axios = require('axios');
const Document = require('../models/Document');
const Task = require('../models/Task');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { generateFileFromJSON } = require('../utils/aiFileGenerator');

// ============================================================
// GIAI DOAN 6: CHUOI PHAN HOI TU DONG
// ============================================================

// Tao VB di tu ban thao AI (tu dong tao van ban phan hoi)
exports.createOutgoingFromAI = async (req, res) => {
  try {
    const { taskId, sourceDocId } = req.body;
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Khong tim thay cong viec' });
    if (!task.aiGeneratedFiles || task.aiGeneratedFiles.length === 0) {
      return res.status(400).json({ message: 'Chua co file AI nao duoc tao' });
    }
    const latestFile = task.aiGeneratedFiles[task.aiGeneratedFiles.length - 1];
    const outgoing = await Document.create({
      type: 'OUTGOING',
      agencyId: req.user.agencyId || null,
      summary: 'Van ban phan hoi - ' + task.title,
      category: 'Cong van',
      status: 'Cho xu ly',
      replyTo: sourceDocId || undefined,
      attachments: [{
        originalName: latestFile.fileName,
        fileName: latestFile.fileName,
        filePath: latestFile.filePath,
        fileSize: 0,
        mimeType: latestFile.fileType === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }],
      notes: 'Duoc tao tu dong boi AI tu cong viec: ' + task.title,
      createdBy: req.user.userId
    });
    await ActivityLog.create({
      action: 'AI_CREATE_OUTGOING',
      targetType: 'Document',
      targetId: outgoing._id,
      userId: req.user.userId,
      details: 'AI tu dong tao VB di phan hoi tu cong viec: ' + task.title
    });
    res.status(201).json({ message: 'Da tao van ban di tu ban thao AI', document: outgoing });
  } catch (err) {
    res.status(500).json({ message: 'Loi tao VB di', error: err.message });
  }
};

// Duyet & Phat hanh van ban
exports.approveDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Khong tim thay van ban' });
    doc.status = 'Hoan thanh';
    doc.issuedDate = new Date();
    await doc.save();
    await ActivityLog.create({
      action: 'APPROVE_DOCUMENT',
      targetType: 'Document',
      targetId: doc._id,
      userId: req.user.userId,
      details: 'Duyet va phat hanh van ban'
    });
    res.json({ message: 'Da duyet va phat hanh van ban', document: doc });
  } catch (err) {
    res.status(500).json({ message: 'Loi duyet VB', error: err.message });
  }
};

// ============================================================
// GIAI DOAN 7: AI SOI LOI & KIEM DUYET
// ============================================================

exports.aiProofread = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Khong tim thay van ban' });
    if (!doc.ocrContent) return res.status(400).json({ message: 'Van ban chua co noi dung OCR' });
    const token = process.env.OPENAI_API_KEY;
    if (!token) return res.status(500).json({ message: 'Chua cau hinh OPENAI_API_KEY' });

    const prompt = `Ban la chuyen gia kiem duyet van ban hanh chinh nha nuoc Viet Nam.
Hay kiem tra van ban sau va tra ve PHIEU SOI LOI chi tiet:

Noi dung van ban:
"""
${doc.ocrContent.substring(0, 6000)}
"""

Hay phan tich va tra ve ket qua theo dung format sau (Markdown):

## PHIEU SOI LOI VAN BAN

### 1. DIEM CHAT LUONG TONG THE: XX/100

### 2. LOI CHINH TA
- Liet ke tung loi chinh ta (neu co), boi do vi tri cu the

### 3. THE THUC VAN BAN
- Kiem tra: Quoc hieu, Tieu ngu, So/Ky hieu, Ngay thang, Trich yeu, Noi nhan
- Danh dau SAI neu thieu hoac sai format theo Nghi dinh 30/2020/ND-CP

### 4. SO LIEU & LOGIC
- Kiem tra so lieu co khop nhau khong (cong tru nhan chia)
- Kiem tra ngay thang co hop ly khong

### 5. VAN PHONG & PHONG CACH
- Danh gia van phong co phu hop van ban hanh chinh khong
- Goi y cai thien cu the

### 6. KET LUAN
- Tom tat: bao nhieu loi, muc do nghiem trong
- Khuyen nghi: Duyet / Can sua / Tu choi`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3
    }, { headers: { 'Authorization': `Bearer ${token}` } });

    const result = response.data.choices[0].message.content.trim();
    res.json({ message: 'AI da kiem duyet xong', proofreadResult: result });
  } catch (err) {
    console.error('Loi AI Proofread:', err.response?.data || err.message);
    res.status(500).json({ message: 'Loi AI kiem duyet', error: err.message });
  }
};

// ============================================================
// GIAI DOAN 8: TONG HOP NHIEU FILE & TRA CUU THONG MINH
// ============================================================

// Tong hop nhieu van ban
exports.aiSynthesizeMultiple = async (req, res) => {
  try {
    const { documentIds } = req.body;
    if (!documentIds || documentIds.length < 2) {
      return res.status(400).json({ message: 'Can chon it nhat 2 van ban' });
    }
    const scope = req.user.agencyId ? { agencyId: req.user.agencyId } : {};
    const docs = await Document.find({ _id: { $in: documentIds }, ...scope });
    if (docs.length < 2) return res.status(400).json({ message: 'Khong tim thay du van ban' });
    const token = process.env.OPENAI_API_KEY;
    if (!token) return res.status(500).json({ message: 'Chua cau hinh OPENAI_API_KEY' });

    let allContent = '';
    docs.forEach((d, i) => {
      allContent += `\n--- VAN BAN ${i+1} ---\nSo: ${d.documentNumber || 'Khong ro'}\nCo quan: ${d.issuingAgency || 'Khong ro'}\nTrich yeu: ${d.summary || 'Khong co'}\nNoi dung:\n${(d.ocrContent || '').substring(0, 2000)}\n`;
    });

    const prompt = `Ban la chuyen vien tong hop bao cao cap tinh.
Hay doc tat ca ${docs.length} van ban sau va TONG HOP thanh 1 bao cao tong ket duy nhat.

${allContent}

Yeu cau:
1. Tom tat noi dung TUNG van ban (ngan gon)
2. Tong hop so lieu chung
3. Danh gia tong the
4. De xuat phuong huong

Tra ve JSON co dang:
{
  "fileType": "docx",
  "documentMeta": { "agencyName": "...", "title": "BAO CAO TONG HOP", "signer": "..." },
  "contentBlocks": [
    { "type": "heading", "text": "..." },
    { "type": "paragraph", "text": "..." }
  ]
}`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.7,
      response_format: { type: "json_object" }
    }, { headers: { 'Authorization': `Bearer ${token}` } });

    const jsonData = JSON.parse(response.data.choices[0].message.content.trim());
    const generatedFile = await generateFileFromJSON(jsonData, req.user, 'synthesis_' + Date.now());

    res.json({
      message: 'AI da tong hop ' + docs.length + ' van ban thanh cong',
      generatedFile,
      summary: jsonData
    });
  } catch (err) {
    console.error('Loi AI Synthesis:', err.response?.data || err.message);
    res.status(500).json({ message: 'Loi tong hop', error: err.message });
  }
};

// Tra cuu bang ngon ngu tu nhien
exports.aiNaturalQuery = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ message: 'Vui long nhap cau hoi' });
    const token = process.env.OPENAI_API_KEY;
    if (!token) return res.status(500).json({ message: 'Chua cau hinh OPENAI_API_KEY' });

    // Lay thong ke nhanh de AI co context (SCOPED theo co quan)
    const scope = req.user.agencyId ? { agencyId: req.user.agencyId } : {};
    const totalIncoming = await Document.countDocuments({ ...scope, type: 'INCOMING' });
    const totalOutgoing = await Document.countDocuments({ ...scope, type: 'OUTGOING' });
    const pendingDocs = await Document.countDocuments({ ...scope, status: 'Cho xu ly' });
    const overdueDocs = await Document.countDocuments({ ...scope, status: 'Qua han' });
    const totalTasks = await Task.countDocuments(scope);
    const doneTasks = await Task.countDocuments({ ...scope, status: 'Hoan thanh' });
    const overdueTasks = await Task.countDocuments({ ...scope, status: 'Qua han' });

    // Lay 20 van ban gan nhat cua CO QUAN
    const recentDocs = await Document.find(scope).sort({ createdAt: -1 }).limit(20).select('documentNumber issuingAgency summary category status urgency deadline createdAt type field');
    const recentTasks = await Task.find(scope).sort({ createdAt: -1 }).limit(15).select('title status priority deadline aiGenerated createdAt');

    const prompt = `Ban la AI tro ly tra cuu du lieu cua he thong E-Office.

THONG KE HE THONG:
- Tong VB den: ${totalIncoming}
- Tong VB di: ${totalOutgoing}
- VB cho xu ly: ${pendingDocs}
- VB qua han: ${overdueDocs}
- Tong cong viec: ${totalTasks}
- CV hoan thanh: ${doneTasks}
- CV qua han: ${overdueTasks}

20 VAN BAN GAN NHAT:
${JSON.stringify(recentDocs, null, 1)}

15 CONG VIEC GAN NHAT:
${JSON.stringify(recentTasks, null, 1)}

CAU HOI CUA NGUOI DUNG:
"${question}"

Hay tra loi cau hoi bang tieng Viet, ro rang, co so lieu cu the. Dinh dang Markdown.
Neu cau hoi ve thong ke, hay trinh bay bang BANG (table).
Neu khong du du lieu de tra loi chinh xac, hay noi ro.`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.5
    }, { headers: { 'Authorization': `Bearer ${token}` } });

    const answer = response.data.choices[0].message.content.trim();
    res.json({ question, answer });
  } catch (err) {
    console.error('Loi AI Query:', err.response?.data || err.message);
    res.status(500).json({ message: 'Loi tra cuu', error: err.message });
  }
};

// ============================================================
// GIAI DOAN 9: KHO TRI THUC & KPI
// ============================================================

// Thong ke KPI cua tung can bo
exports.getStaffKPI = async (req, res) => {
  try {
    // KPI chỉ tính cho cán bộ cùng cơ quan
    const userFilter = { role: { $ne: 'CITIZEN' } };
    if (req.user.agencyId) userFilter.agencyId = req.user.agencyId;
    const users = await User.find(userFilter).select('username role email');
    const kpiData = [];

    for (const user of users) {
      const assigned = await Document.countDocuments({ assignedTo: user._id });
      const completed = await Document.countDocuments({ assignedTo: user._id, status: 'Hoan thanh' });
      const overdue = await Document.countDocuments({ assignedTo: user._id, status: 'Qua han' });
      const tasksTotal = await Task.countDocuments({ assignedTo: user._id });
      const tasksDone = await Task.countDocuments({ assignedTo: user._id, status: 'Hoan thanh' });
      const tasksOverdue = await Task.countDocuments({ assignedTo: user._id, status: 'Qua han' });

      const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
      const taskCompletionRate = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

      let rating = 'Chua du du lieu';
      const avgRate = (completionRate + taskCompletionRate) / 2;
      if (assigned + tasksTotal >= 3) {
        if (avgRate >= 90) rating = 'Xuat sac';
        else if (avgRate >= 75) rating = 'Tot';
        else if (avgRate >= 50) rating = 'Kha';
        else rating = 'Can cai thien';
      }

      kpiData.push({
        user: { _id: user._id, username: user.username, role: user.role, email: user.email },
        docs: { assigned, completed, overdue },
        tasks: { total: tasksTotal, done: tasksDone, overdue: tasksOverdue },
        completionRate,
        taskCompletionRate,
        rating
      });
    }

    // Sap xep theo ty le hoan thanh giam dan
    kpiData.sort((a, b) => ((b.completionRate + b.taskCompletionRate) / 2) - ((a.completionRate + a.taskCompletionRate) / 2));

    res.json(kpiData);
  } catch (err) {
    res.status(500).json({ message: 'Loi lay KPI', error: err.message });
  }
};

// AI danh gia KPI
exports.aiEvaluateKPI = async (req, res) => {
  try {
    const token = process.env.OPENAI_API_KEY;
    if (!token) return res.status(500).json({ message: 'Chua cau hinh OPENAI_API_KEY' });

    const users = await User.find({ role: { $ne: 'CITIZEN' } }).select('username role');
    let kpiSummary = '';
    for (const user of users) {
      const assigned = await Document.countDocuments({ assignedTo: user._id });
      const completed = await Document.countDocuments({ assignedTo: user._id, status: 'Hoan thanh' });
      const overdue = await Document.countDocuments({ assignedTo: user._id, status: 'Qua han' });
      const tasksTotal = await Task.countDocuments({ assignedTo: user._id });
      const tasksDone = await Task.countDocuments({ assignedTo: user._id, status: 'Hoan thanh' });
      kpiSummary += `- ${user.username} (${user.role}): VB giao=${assigned}, hoan thanh=${completed}, qua han=${overdue}. CV: tong=${tasksTotal}, xong=${tasksDone}\n`;
    }

    const prompt = `Ban la Giam doc So Noi vu, hay danh gia KPI cua cac can bo sau:

${kpiSummary}

Hay viet nhan xet chi tiet cho TUNG nguoi (khen/che cu the), xep loai (Xuat sac/Tot/Kha/Can cai thien), va de xuat giai phap cho nhung nguoi can cai thien.
Dinh dang Markdown, chuyen nghiep, co bang tong hop cuoi cung.`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7
    }, { headers: { 'Authorization': `Bearer ${token}` } });

    res.json({ evaluation: response.data.choices[0].message.content.trim() });
  } catch (err) {
    res.status(500).json({ message: 'Loi AI KPI', error: err.message });
  }
};

// ============================================================
// GIAI DOAN 4 (EGov): AI THANH TRA & TONG HOP CHEO
// ============================================================

exports.crossAgencySynthesis = async (req, res) => {
  try {
    const { agencyId } = req.user;
    if (!agencyId) return res.status(403).json({ message: 'Chưa có cơ quan' });

    const Document = require('../models/Document');
    const Agency = require('../models/Agency');
    
    // Tìm tất cả các xã trực thuộc Tỉnh hiện tại
    const childAgencies = await Agency.find({ parentAgency: agencyId });
    if (childAgencies.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy cơ quan cấp dưới nào' });
    }
    const childIds = childAgencies.map(a => a._id);

    // Lấy 50 văn bản gần nhất của tất cả các xã
    const docs = await Document.find({ agencyId: { $in: childIds } }).limit(50).populate('agencyId', 'name');

    if (docs.length === 0) return res.status(400).json({ message: 'Chưa có dữ liệu từ cấp dưới' });

    let context = docs.map(d => `- Cơ quan: ${d.agencyId?.name} | Loại: ${d.type} | Trạng thái: ${d.status} | Trích yếu: ${d.summary}`).join('\n');

    const token = process.env.OPENAI_API_KEY;
    const prompt = `Bạn là Trợ lý Tổng hợp AI cấp Tỉnh. Dưới đây là dữ liệu 50 văn bản gần nhất từ các Phường/Xã trực thuộc:
    
${context}

Yêu cầu:
1. Đánh giá tổng quan tình hình xử lý văn bản của các Xã (xã nào tồn đọng nhiều, xã nào làm tốt).
2. Phát hiện các điểm nghẽn hoặc vấn đề chung.
3. Đề xuất chỉ đạo từ cấp Tỉnh xuống.
Trình bày bằng Markdown rõ ràng.`;

    const axios = require('axios');
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5
    }, { headers: { 'Authorization': `Bearer ${token}` } });

    res.json({ synthesis: response.data.choices[0].message.content.trim() });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi tổng hợp chéo', error: err.message });
  }
};
