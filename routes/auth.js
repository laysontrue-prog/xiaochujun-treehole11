const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { JWT_SECRET } = require('../utils/config');

console.log('auth 路由加载成功，用户模型：', User); 

// 注册
router.post('/register', async (req, res) => {
  console.log('收到注册请求：', req.body);
  const { studentId, nickname, password } = req.body;
  try {
    if (!studentId || !nickname || !password) {
      return res.status(400).json({ message: '所有字段都要填哦～' });
    }

    const existingUser = await User.findOne({ studentId });
    if (existingUser) {
      return res.status(400).json({ message: '学号已被注册' });
    }

    const user = new User({ studentId, nickname, password });
    await user.save();
    console.log('注册成功，新用户：', user);

    const token = jwt.sign({ userId: user._id, nickname, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: '注册成功', token, nickname, role: user.role });
  } catch (err) {
    console.log('注册错误：', err.message);
    res.status(500).json({ message: '注册失败，请重试' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  console.log('收到登录请求：', req.body);
  const { studentId, password } = req.body;
  try {
    const user = await User.findOne({ studentId });
    if (!user || !await user.comparePassword(password)) {
      return res.status(401).json({ message: '学号或密码错误' });
    }

    const token = jwt.sign({ userId: user._id, nickname: user.nickname, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: '登录成功', token, nickname: user.nickname, role: user.role });
  } catch (err) {
    console.log('登录错误：', err.message);
    res.status(500).json({ message: '登录失败，请重试' });
  }
});

// 访客登录
router.post('/guest', (req, res) => {
  const token = jwt.sign({ guest: true }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ message: '访客登录成功', token, nickname: '访客' });
});

// 管理员登录
router.post('/admin-login', (req, res) => {
  const { password } = req.body;
  if (password === 'xiaochujun2025') {
    const token = jwt.sign(
      { userId: 'admin', nickname: '管理员', role: 'admin' }, 
      JWT_SECRET, 
      { expiresIn: '1d' }
    );
    res.json({ message: '管理员登录成功', token });
  } else {
    res.status(401).json({ message: '密码错误' });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    // 从请求头获取token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: '未登录' });
    }

    // 解析token获取用户信息
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 如果是访客用户，直接返回访客信息
    if (decoded.guest) {
      return res.json({ nickname: '访客用户', studentId: '访客用户' });
    }

    // 从数据库获取完整用户信息
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 返回学号、昵称和角色信息（不返回密码）
    res.json({ studentId: user.studentId, nickname: user.nickname, role: user.role });
  } catch (err) {
    console.log('获取用户信息错误：', err.message);
    res.status(500).json({ message: '获取用户信息失败' });
  }
});

// 修改密码
router.post('/change-password', async (req, res) => {
  try {
    // 从请求头获取token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: '未登录' });
    }

    // 解析token获取用户信息
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 如果是访客用户，不允许修改密码
    if (decoded.guest) {
      return res.status(403).json({ message: '访客用户无法修改密码' });
    }

    // 从数据库获取用户
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const { oldPassword, newPassword } = req.body;
    
    // 验证当前密码
    if (!await user.comparePassword(oldPassword)) {
      return res.status(400).json({ message: '当前密码错误' });
    }

    // 更新密码
    user.password = newPassword;
    await user.save();

    res.json({ message: '密码修改成功' });
  } catch (err) {
    console.log('修改密码错误：', err.message);
    res.status(500).json({ message: '修改密码失败' });
  }
});

module.exports = router;
