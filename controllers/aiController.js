const axios = require('axios');

exports.chat = async (req, res) => {
  try {
    const { message } = req.body;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return res.json({ 
        reply: "Hệ thống AI đang được bảo trì hoặc chưa cấu hình Token OpenAI. Vui lòng liên hệ Admin." 
      });
    }

    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const response = await axios.post(endpoint, {
      messages: [
        { role: 'system', content: 'Bạn là Trợ lý ảo Chính quyền số tỉnh Đắk Lắk. Nhiệm vụ của bạn là tư vấn pháp luật, hướng dẫn thủ tục hành chính, giải đáp thắc mắc về chiến dịch thanh niên tình nguyện một cách ngắn gọn, súc tích, thân thiện và chính xác.' },
        { role: 'user', content: message }
      ],
      model: 'gpt-4o-mini', 
      temperature: 0.7,
      max_tokens: 1000
    }, {
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const reply = response.data.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    const errData = err.response ? err.response.data : err.message;
    console.error("AI API Error:", errData);
    require('fs').appendFileSync('ai_error_log.txt', new Date().toISOString() + ' - ' + JSON.stringify(errData) + '\n');
    res.status(500).json({ message: 'Lỗi kết nối AI Server', error: err.message });
  }
};
