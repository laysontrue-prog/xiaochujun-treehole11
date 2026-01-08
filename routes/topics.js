const express = require('express');
const router = express.Router();
const Topic = require('../models/Topic');
const User = require('../models/User');
const dbReady = require('../middleware/dbReady'); // 数据库连接检查
const auth = require('../middleware/auth');
const apicache = require('apicache');
const cache = apicache.middleware;
const { uploadImage } = require('../utils/imageHandler');

// 获取所有话题列表（支持分页）
// 性能优化：对于频繁变动的内容，移除 API 级别长时间缓存，确保数据实时性
router.get('/', dbReady, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  const topics = await Topic.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
  const total = await Topic.countDocuments();
  
  res.json({
    topics,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalItems: total
  });
});

// 创建新话题（学生用）
router.post('/', async (req, res) => {
  const { title, description, icon = '💬' } = req.body;
  const topic = new Topic({ title, description, icon });
  await topic.save();
  res.json(topic);
});

// 获取单个话题详情（支持回复分页）
router.get('/:id', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  const topic = await Topic.findById(req.params.id);
  if (!topic) return res.status(404).json({ message: '话题不存在' });
  
  // 提取所有回复的用户ID进行实时头像同步
  const userIds = topic.replies.map(r => r.userId).filter(id => id);
  const users = await User.find({ _id: { $in: userIds } }, 'avatar nickname');
  const userMap = {};
  users.forEach(u => userMap[u._id.toString()] = u);

  // 计算回复总数
  const totalReplies = topic.replies.length;
  
  // 对回复进行分页并同步最新头像
  const paginatedReplies = topic.replies.slice(skip, skip + limit).map(reply => {
    const r = reply.toObject();
    if (r.userId && userMap[r.userId.toString()] && !r.isAnonymous) {
      r.avatar = userMap[r.userId.toString()].avatar || r.avatar;
      r.author = userMap[r.userId.toString()].nickname || r.author;
    }
    return r;
  });
  
  // 返回话题详情和分页后的回复
  res.json({
    _id: topic._id,
    title: topic.title,
    description: topic.description,
    icon: topic.icon,
    replies: paginatedReplies,
    createdAt: topic.createdAt,
    updatedAt: topic.updatedAt,
    currentPage: page,
    totalPages: Math.ceil(totalReplies / limit),
    totalReplies: totalReplies
  });
});

// 添加回复（直接保存，不审核）
router.post('/:id/reply', auth, async (req, res) => {
  const { content, isAnonymous = false, images = [] } = req.body;
  const author = isAnonymous ? '匿名' : (req.user.nickname || '用户');
  const userId = req.user.userId;

  const topic = await Topic.findById(req.params.id);
  if (!topic) return res.status(404).json({ message: '话题不存在' });

  // 获取当前头像
  const user = await User.findById(userId);
  const avatar = user ? user.avatar : '';

  // 验证图片数量
  if (images && images.length > 4) {
    return res.status(400).json({ message: '最多只能上传 4 张图片' });
  }

  // 处理图片上传
  let processedImages = [];
  if (images && Array.isArray(images) && images.length > 0) {
    try {
      console.log(`[Topic] 正在处理 ${images.length} 张图片...`);
      processedImages = await Promise.all(images.map(img => uploadImage(img)));
      processedImages = processedImages.filter(img => img);
    } catch (err) {
      console.error('图片处理失败:', err);
      return res.status(400).json({ message: '图片上传失败: ' + err.message });
    }
  }

  topic.replies.push({ 
    content, 
    author, 
    userId,
    avatar, 
    isAnonymous, 
    images: processedImages 
  });
  await topic.save();
  res.json({ message: '回复成功' });
});

// 老师：删除整个话题
router.delete('/:id', async (req, res) => {
  await Topic.findByIdAndDelete(req.params.id);
  res.json({ message: '话题已删除' });
});

// 老师：删除单个回复
router.delete('/:topicId/reply/:replyId', async (req, res) => {
  const topic = await Topic.findById(req.params.topicId);
  if (!topic) return res.status(404).json({ message: '话题不存在' });

  topic.replies.id(req.params.replyId).remove();
  await topic.save();
  res.json({ message: '回复已删除' });
});

module.exports = router;