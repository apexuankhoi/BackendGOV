const axios = require('axios');
const Document = require('../models/Document');
const Task = require('../models/Task');
const ChatMessage = require('../models/ChatMessage');
const { generateFileFromJSON } = require('../utils/aiFileGenerator');

// Lay lich su chat cua 1 van ban
exports.getChatHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'document' hoac 'task'
    
    const filter = type === 'task' ? { taskId: id } : { documentId: id };
    const messages = await ChatMessage.find(filter)
      .sort({ createdAt: 1 })
      .limit(50)
      .populate('userId', 'username role');
    
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Loi tai lich su chat', error: err.message });
  }
};

// GUI TIN NHAN CHAT VOI AI
exports.sendChatMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, type } = req.body; // type: 'document' | 'task'
    
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Tin nhan khong duoc de trong' });
    }
    
    const token = process.env.OPENAI_API_KEY;
    if (!token) return res.status(500).json({ message: 'Chua cau hinh OPENAI_API_KEY' });
    
    // 1. Lay context tu van ban hoac cong viec
    let contextText = '';
    let contextTitle = '';
    let sourceDoc = null;
    
    if (type === 'task') {
      const task = await Task.findById(id).populate('sourceDocument');
      if (!task) return res.status(404).json({ message: 'Khong tim thay cong viec' });
      contextTitle = task.title;
      contextText = `Ten cong viec: "${task.title}"\nMo ta: "${task.description || 'Khong co'}"`;
      if (task.sourceDocument && task.sourceDocument.ocrContent) {
        contextText += `\n\nNoi dung van ban goc:\n"""\n${task.sourceDocument.ocrContent.substring(0, 5000)}\n"""`;
      }
      if (task.aiSolution) {
        contextText += `\n\nKet qua AI da lam truoc do:\n"""\n${task.aiSolution.substring(0, 2000)}\n"""`;
      }
    } else {
      sourceDoc = await Document.findById(id);
      if (!sourceDoc) return res.status(404).json({ message: 'Khong tim thay van ban' });
      contextTitle = sourceDoc.summary || sourceDoc.documentNumber || 'Van ban';
      contextText = `So van ban: ${sourceDoc.documentNumber || 'Khong ro'}
Co quan ban hanh: ${sourceDoc.issuingAgency || 'Khong ro'}
Trich yeu: ${sourceDoc.summary || 'Khong co'}
Ngay ban hanh: ${sourceDoc.issuedDate ? new Date(sourceDoc.issuedDate).toLocaleDateString('vi-VN') : 'Khong ro'}
Nguoi ky: ${sourceDoc.signer || 'Khong ro'}
Linh vuc: ${sourceDoc.field || 'Khong ro'}
Han xu ly: ${sourceDoc.deadline ? new Date(sourceDoc.deadline).toLocaleDateString('vi-VN') : 'Khong co'}
Trang thai: ${sourceDoc.status || 'Khong ro'}`;
      if (sourceDoc.ocrContent) {
        contextText += `\n\nNoi dung day du cua van ban (OCR):\n"""\n${sourceDoc.ocrContent.substring(0, 6000)}\n"""`;
      }
    }
    
    // 2. Lay lich su chat gan nhat (toi da 10 tin)
    const filter = type === 'task' ? { taskId: id } : { documentId: id };
    const history = await ChatMessage.find(filter).sort({ createdAt: -1 }).limit(10);
    history.reverse();
    
    const historyMessages = history.map(m => ({
      role: m.role,
      content: m.content
    }));
    
    // 3. Tao prompt
    const systemPrompt = `Ban la Chuyen vien Ao (AI Virtual Clerk) cua co quan nha nuoc.
Ban dang ho tro xu ly ${type === 'task' ? 'cong viec' : 'van ban'}: "${contextTitle}".

Day la thong tin chi tiet:
${contextText}

Nhiem vu cua ban:
- Tra loi cau hoi cua nguoi dung ve van ban/cong viec nay.
- Neu nguoi dung yeu cau soan thao (bao cao, cong van, ke hoach...), hay SOAN THAO NGAY noi dung day du.
- Neu nguoi dung yeu cau tom tat, hay tom tat ngan gon va chinh xac.
- Neu nguoi dung yeu cau sua noi dung, hay viet lai phien ban moi.
- Dinh dang bang Markdown. Khong can chao hoi.
- Tra loi bang tieng Viet chuan.

LUU Y QUAN TRONG: Neu nguoi dung yeu cau tao/soan FILE (Word, Excel, bao cao, cong van, ke hoach...),
hay tra ve JSON co dang:
{"generateFile": true, "fileType": "docx", "documentMeta": {...}, "contentBlocks": [...]}
De he thong tu dong sinh file vat ly. Chi tra JSON khi nguoi dung YEU CAU XUAT FILE cu the.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: message }
    ];
    
    // 4. Goi AI
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 2000,
      temperature: 0.7
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const aiResponse = response.data.choices[0].message.content.trim();
    
    // 5. Kiem tra xem AI co tra ve JSON de sinh file khong
    let generatedFile = null;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*"generateFile"\s*:\s*true[\s\S]*\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        if (jsonData.generateFile) {
          generatedFile = await generateFileFromJSON(jsonData, req.user, id);
        }
      }
    } catch (e) {
      // Khong phai JSON, bo qua
    }
    
    // 6. Luu tin nhan cua user
    const userMsg = await ChatMessage.create({
      ...(type === 'task' ? { taskId: id } : { documentId: id }),
      userId: req.user.userId,
      role: 'user',
      content: message
    });
    
    // 7. Luu tin nhan cua AI
    const aiMsg = await ChatMessage.create({
      ...(type === 'task' ? { taskId: id } : { documentId: id }),
      userId: req.user.userId,
      role: 'assistant',
      content: aiResponse,
      generatedFile: generatedFile || undefined
    });
    
    res.json({
      userMessage: userMsg,
      aiMessage: aiMsg,
      generatedFile: generatedFile
    });
    
  } catch (err) {
    console.error('Loi AI Chat:', err.response?.data || err.message);
    res.status(500).json({ message: 'Loi AI Chat', error: err.message });
  }
};

// XOA LICH SU CHAT
exports.clearChatHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    const filter = type === 'task' ? { taskId: id } : { documentId: id };
    await ChatMessage.deleteMany(filter);
    res.json({ message: 'Da xoa lich su chat' });
  } catch (err) {
    res.status(500).json({ message: 'Loi xoa lich su', error: err.message });
  }
};
