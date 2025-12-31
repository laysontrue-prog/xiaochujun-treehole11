const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../utils/config');

module.exports = function(req, res, next) {
  // 从请求头获取token（支持两种格式：x-auth-token 和 Authorization: Bearer token）
  let token = req.header('x-auth-token');
  
  // 检查Authorization header
  if (req.header('Authorization')) {
    const authHeader = req.header('Authorization');
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    }
  }
  
  // 如果没有token，返回401未授权
  if (!token) {
    return res.status(401).json({ message: '没有token，授权被拒绝' });
  }
  
  try {
    // 验证token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 将用户信息保存到请求对象中
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'token已过期', code: 'TOKEN_EXPIRED' });
    }
    res.status(401).json({ message: 'token无效', code: 'TOKEN_INVALID', error: err.message });
  }
};
