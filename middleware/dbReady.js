const mongoose = require('mongoose');

// 数据库连接检查中间件
const dbReady = async (req, res, next) => {
  try {
    // 等待数据库连接就绪
    if (mongoose.connection.readyState !== 1) {
      console.log('等待数据库连接...');
      await new Promise((resolve) => {
        const checkConnection = () => {
          if (mongoose.connection.readyState === 1) {
            resolve();
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }
    next();
  } catch (error) {
    console.error('数据库连接检查失败:', error);
    res.status(503).json({ message: '数据库连接不可用，请稍后重试' });
  }
};

module.exports = dbReady;