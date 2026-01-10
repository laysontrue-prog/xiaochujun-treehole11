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
const BOOT_START_MS = Date.now();
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
app.use(express.json({ limit: '50mb' })); // 增加请求体大小限制，防止图片上传报错
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 性能优化：静态资源长期缓存 (1年)
app.use(express.static('public', {
  etag: true,
  setHeaders: (res, filePath) => {
    const lower = String(filePath || '').toLowerCase();
    if (lower.endsWith('.html') || lower.endsWith(`${path.sep}sw.js`)) {
      res.setHeader('Cache-Control', 'no-cache');
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

const getMongoState = () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state = states[mongoose.connection.readyState] || 'unknown';
  return { readyState: mongoose.connection.readyState, state };
};

app.get(['/health', '/healthz'], (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    pid: process.pid,
    memory: process.memoryUsage(),
    mongo: getMongoState()
  });
});

app.get('/readyz', (req, res) => {
  const mongo = getMongoState();
  if (mongo.readyState === 1) {
    return res.status(200).json({ status: 'READY', timestamp: new Date().toISOString(), mongo });
  }
  return res.status(503).json({ status: 'NOT_READY', timestamp: new Date().toISOString(), mongo });
});

app.use('/api/posts', require('./routes/posts'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/likes', require('./routes/likes'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/capsules', require('./routes/capsules'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/tools', require('./routes/tools'));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API路由不存在' });
});

app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: '上传内容过大，请压缩图片或减少数量' });
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: '无效的 JSON 格式' });
  }

  res.status(500).json({ message: '服务器内部错误', error: err.message });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`树洞已启动：http://localhost:${PORT}`);
  console.log(`老师审核地址：http://localhost:${PORT}/admin`);
  console.log(`启动耗时(ms): ${Date.now() - BOOT_START_MS}`);
});

let mongoRetryDelayMs = 2000;
const connectDB = async () => {
  const state = mongoose.connection.readyState;
  if (state === 1 || state === 2) return;

  const start = Date.now();
  try {
    console.log('⏳ 正在连接 MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      bufferCommands: true,
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 10),
      minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 0),
      maxIdleTimeMS: Number(process.env.MONGO_MAX_IDLE_MS || 60000)
    });
    console.log(`✅ MongoDB 连接成功！耗时(ms): ${Date.now() - start}`);
    mongoRetryDelayMs = 2000;
  } catch (err) {
    console.log(`❌ MongoDB 连接失败：${err.message}，${mongoRetryDelayMs}ms 后重试`);
    setTimeout(connectDB, mongoRetryDelayMs);
    mongoRetryDelayMs = Math.min(60000, Math.floor(mongoRetryDelayMs * 1.6));
  }
};

connectDB();
