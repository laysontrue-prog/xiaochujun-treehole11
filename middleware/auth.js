const jwt = require('jsonwebtoken');

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // 将用户信息保存到请求对象中
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'token无效' });
  }
};
