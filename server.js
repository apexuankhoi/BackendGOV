require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const teamRoutes = require('./routes/teams');
const userRoutes = require('./routes/users');
const newsRoutes = require('./routes/news');
const configRoutes = require('./routes/config');

// eOffice routes
const documentRoutes = require('./routes/documents');
const taskRoutes = require('./routes/tasks');
const activityLogRoutes = require('./routes/activityLog');

const app = express();
const PORT = process.env.PORT || 5000;

// Cho phép Express đọc đúng IP khi deploy phía sau Reverse Proxy (Nginx, Vercel, Heroku...)
app.set('trust proxy', 1);

// Rate limiting (Tối đa 500 requests / 15 phút / IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau.' }
});

// Middleware Bảo mật
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" })); // Cho phép load ảnh từ domain khác
app.use('/api/', limiter);

// Middleware
app.use(cors());
app.use(express.json());

// Cấu hình Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Webgov Đắk Lắk API',
      version: '1.0.0',
      description: 'Tài liệu API cho Hệ thống Quản trị chiến dịch Mùa Hè Xanh'
    },
    servers: [{ url: `http://localhost:${PORT}` }]
  },
  apis: ['./routes/*.js']
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Kết nối tới MongoDB
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

// Gắn io vào app để dùng ở mọi Controller (req.app.get('io'))
app.set('io', io);

// Theo dõi người dùng Online
let onlineUsers = 0;
io.on('connection', (socket) => {
  onlineUsers++;
  io.emit('onlineUsers', onlineUsers); // Broadcast số lượng online

  socket.on('disconnect', () => {
    onlineUsers--;
    io.emit('onlineUsers', onlineUsers);
  });
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/webgov_daklak')
  .then(() => {
    console.log('✅ Đã kết nối MongoDB');
    server.listen(PORT, async () => {
      console.log(`🚀 Server đang chạy tại port ${PORT}`);
      console.log(`🌐 WebSocket Server đang lắng nghe!`);
      
      // Kiểm tra kết nối OpenAI
      const token = process.env.OPENAI_API_KEY;
      if (!token) {
        console.log('⚠️ Chưa cấu hình OPENAI_API_KEY trong file .env');
      } else {
        try {
          const axios = require('axios');
          await axios.get('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          console.log('✅ Đã kết nối thành công đến OpenAI API!');
        } catch (err) {
          console.log('❌ Lỗi kết nối OpenAI API:', err.response?.data?.error?.message || err.message);
        }
      }
    });
  }).catch(err => {
  console.error('Lỗi kết nối DB:', err);
});

// Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/users', userRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/config', configRoutes);

// eOffice Routes
app.use('/api/documents', documentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/activity-log', activityLogRoutes);
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running correctly.' });
});


