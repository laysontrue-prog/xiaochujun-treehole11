const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Topic = require('../models/Topic');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { JWT_SECRET } = require('../utils/config');

console.log('auth 路由加载成功，用户模型：', User); 

// 注册
router.post('/register', async (req, res) => {
  const { studentId, nickname, password } = req.body;
  console.log('收到注册请求：', studentId);
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
    res.json({ message: '注册成功', token, nickname, role: user.role, avatar: user.avatar });
  } catch (err) {
    console.log('注册错误：', err.message);
    res.status(500).json({ message: '注册失败，请重试' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  console.log('收到登录请求：', req.body.studentId);
  const { studentId, password } = req.body;
  const startTime = Date.now();
  try {
    console.log('[Auth] 正在查询用户...');
    const user = await User.findOne({ studentId });
    console.log(`[Auth] 用户查询耗时: ${Date.now() - startTime}ms`);
    
    if (!user) {
      console.log('[Auth] 用户不存在');
      return res.status(401).json({ message: '学号或密码错误' });
    }

    console.log('[Auth] 正在验证密码...');
    const passStartTime = Date.now();
    const isMatch = await user.comparePassword(password);
    console.log(`[Auth] 密码验证耗时: ${Date.now() - passStartTime}ms`);

    if (!isMatch) {
      console.log('[Auth] 密码错误');
      return res.status(401).json({ message: '学号或密码错误' });
    }

    console.log('[Auth] 登录成功，正在生成Token...');
    const token = jwt.sign({ userId: user._id, nickname: user.nickname, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log(`[Auth] 总登录耗时: ${Date.now() - startTime}ms`);
    res.json({ message: '登录成功', token, nickname: user.nickname, role: user.role, avatar: user.avatar });
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

    // 返回完整用户信息
    res.json({ 
      studentId: user.studentId, 
      nickname: user.nickname, 
      avatar: user.avatar,
      role: user.role,
      level: user.level || 1,
      experience: user.experience || 0,
      checkInHistory: user.checkInHistory || [],
      consecutiveCheckIns: user.consecutiveCheckIns || 0
    });
  } catch (err) {
    console.log('获取用户信息错误：', err.message);
    res.status(500).json({ message: '获取用户信息失败' });
  }
});

// 更新头像
router.post('/avatar', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: '未登录' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.guest) return res.status(403).json({ message: '访客无法修改头像' });

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: '用户不存在' });

    const { avatar } = req.body;
    if (!avatar) return res.status(400).json({ message: '头像不能为空' });

    // 保存历史头像
    if (user.avatar && user.avatar !== avatar) {
      user.avatarHistory = user.avatarHistory || [];
      user.avatarHistory.unshift(user.avatar); // 添加到开头
      if (user.avatarHistory.length > 3) {
        user.avatarHistory.pop(); // 保持最近3个
      }
    }

    user.avatar = avatar;
    await user.save();

    // 1. 强力同步所有帖子 (双重保障：userId 或 author 匹配)
    // 针对有 userId 的新帖子
    await Post.updateMany(
      { userId: user._id, isAnonymous: false },
      { $set: { authorAvatar: avatar } }
    );
    // 针对只有昵称的旧帖子（兜底）
    await Post.updateMany(
      { author: user.nickname, isAnonymous: false, userId: { $exists: false } },
      { $set: { authorAvatar: avatar } }
    );

    // 2. 强力同步所有评论
    await Comment.updateMany(
      { userId: user._id },
      { $set: { authorAvatar: avatar } }
    );
    await Comment.updateMany(
      { author: user.nickname, userId: { $exists: false } },
      { $set: { authorAvatar: avatar } }
    );

    // 3. 强力同步话题回复中的头像
    // 话题回复是嵌入式数组，直接查询包含该用户昵称的话题
    const topics = await Topic.find({ "replies.author": user.nickname });
    for (let topic of topics) {
      let modified = false;
      topic.replies.forEach(reply => {
        // 如果是该用户的实名回复
        if (reply.author === user.nickname && !reply.isAnonymous) {
          reply.avatar = avatar;
          // 顺便补全 userId 以便后续实时联动
          if (!reply.userId) reply.userId = user._id;
          modified = true;
        }
      });
      if (modified) {
        await topic.save();
      }
    }

    res.json({ message: '头像更新成功', avatar: user.avatar });
  } catch (err) {
    console.log('头像更新错误：', err.message);
    res.status(500).json({ message: '头像更新失败' });
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

const { addExperience } = require('../utils/levelSystem');

// 签到接口
router.post('/checkin', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: '未登录' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.guest) return res.status(403).json({ message: '访客不能签到哦' });

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: '用户不存在' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 检查是否已签到
    if (user.lastCheckIn) {
      const last = new Date(user.lastCheckIn);
      last.setHours(0, 0, 0, 0);
      if (last.getTime() === today.getTime()) {
        return res.status(400).json({ message: '今天已经签到过了哦' });
      }
      
      // 检查连签
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (last.getTime() === yesterday.getTime()) {
        user.consecutiveCheckIns += 1;
      } else {
        user.consecutiveCheckIns = 1;
      }
    } else {
      user.consecutiveCheckIns = 1;
    }

    // 计算基础经验值
    let expGain = 1;
    let bonusMsg = '';
    if (user.consecutiveCheckIns % 30 === 0) {
      expGain += 20;
      bonusMsg = '连续签到30天奖励！';
    } else if (user.consecutiveCheckIns % 7 === 0) {
      expGain += 5;
      bonusMsg = '连续签到7天奖励！';
    }

    user.lastCheckIn = new Date();
    user.checkInHistory.push(new Date());
    await user.save();

    // 使用新的等级系统添加经验
    const result = await addExperience(user._id, expGain);

    res.json({
      message: `签到成功！经验+${expGain} ${bonusMsg}`,
      level: result ? result.newLevel : user.level,
      experience: result ? result.newExperience : user.experience,
      consecutiveCheckIns: user.consecutiveCheckIns,
      levelUp: result ? result.levelUp : false
    });

  } catch (err) {
    console.log('签到错误：', err);
    res.status(500).json({ message: '签到失败' });
  }
});

module.exports = router;
