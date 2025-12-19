const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============ 中国大陆最稳连接方式（专治超时） ============
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 60000, // 等60秒
      socketTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      bufferCommands: false, // 关闭缓冲，防止 buffering timed out
      maxPoolSize: 10,
    });
    console.log('✅ MongoDB 连接成功！现在注册登录超级稳');
  } catch (err) {
    console.log('MongoDB 连接失败：', err.message);
  }
};

connectDB(); // 启动连接

// 路由
app.use('/api/posts', require('./routes/posts'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/likes', require('./routes/likes'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/capsules', require('./routes/capsules'));
app.use('/api/notifications', require('./routes/notifications'));

// 老师审核页面
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 兜底路由
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`树洞已启动：http://localhost:${PORT}`);
  console.log(`老师审核地址：http://localhost:${PORT}/admin`);
});