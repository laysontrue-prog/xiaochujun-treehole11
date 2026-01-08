const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http'); // 引入http模块
const { Server } = require('socket.io'); // 引入socket.io
const notificationService = require('./utils/notificationService'); // 引入通知服务
const compression = require('compression'); // 引入压缩中间件

dotenv.config();
const app = express();
const server = http.createServer(app); // 创建http server
const io = new Server(server, {
  cors: {
    origin: "*", // 允许跨域
    methods: ["GET", "POST"]
  }
});

// 初始化通知服务
notificationService.init(io);

// 性能优化：启用Gzip压缩
app.use(compression());

app.use(cors());
app.use(express.json());

// 性能优化：静态资源长期缓存 (1年)
app.use(express.static('public', {
  maxAge: '1y',
  etag: true
}));

// 健康检查端点 (Render保活)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// ============ 中国大陆最稳连接方式（专治超时） ============
const connectDB = async () => {
  try {
    console.log('⏳ 正在连接 MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 60000, // 等60秒
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      bufferCommands: true,
      maxPoolSize: 10,
    });
    console.log('✅ MongoDB 连接成功！现在注册登录超级稳');
    
    // 路由
    app.use('/api/posts', require('./routes/posts'));
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/topics', require('./routes/topics'));
    app.use('/api/likes', require('./routes/likes'));
    app.use('/api/comments', require('./routes/comments'));
    app.use('/api/capsules', require('./routes/capsules'));
    app.use('/api/notifications', require('./routes/notifications'));
    app.use('/api/tools', require('./routes/tools'));

    // 老师审核页面
    app.get('/admin', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    });

    // 兜底路由
    app.use((req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // 连接成功后启动服务器
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`树洞已启动：http://localhost:${PORT}`);
      console.log(`老师审核地址：http://localhost:${PORT}/admin`);
    });
  } catch (err) {
    console.log('❌ MongoDB 连接失败：', err.message);
    process.exit(1); 
  }
};

connectDB(); // 启动连接