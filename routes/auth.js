const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

console.log('auth 路由加载成功，用户模型：', User); // 加日志，检查模型是否加载

// 注册
router.post('/register', async (req, res) => {
  console.log('收到注册请求：', req.body); // 加日志，看请求是否到达
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
    console.log('注册成功，新用户：', user); // 加日志，看是否存进数据库

    const token = jwt.sign({ userId: user._id, nickname }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: '注册成功', token, nickname });
  } catch (err) {
    console.log('注册错误：', err.message); // 加日志，看具体错误
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

    const token = jwt.sign({ userId: user._id, nickname: user.nickname }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: '登录成功', token, nickname: user.nickname });
  } catch (err) {
    console.log('登录错误：', err.message);
    res.status(500).json({ message: '登录失败，请重试' });
  }
});

// 访客登录
router.post('/guest', (req, res) => {
  const token = jwt.sign({ guest: true }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.json({ message: '访客登录成功', token, nickname: '访客' });
});

module.exports = router;