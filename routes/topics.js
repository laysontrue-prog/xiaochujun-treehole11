const express = require('express');
const router = express.Router();
const Topic = require('../models/Topic');
const User = require('../models/User');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const dbReady = require('../middleware/dbReady'); // 数据库连接检查
const auth = require('../middleware/auth');
const apicache = require('apicache');
const cache = apicache.middleware;
const { uploadImage } = require('../utils/imageHandler');
const { addExperience } = require('../utils/levelSystem');

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
  console.log(`[Topic] Creating new topic: ${title}`);
  const topic = new Topic({ title, description, icon });
  await topic.save();
  console.log(`[Topic] Created topic: ${topic._id}`);
  res.json(topic);
});

// 获取单个话题详情（支持回复分页、排序）
router.get('/:id', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const sort = req.query.sort || 'time'; // 'time' (default) or 'heat'
  const order = req.query.order === 'asc' ? 1 : -1; // 'desc' (default) or 'asc'
  
  const topic = await Topic.findById(req.params.id);
  if (!topic) return res.status(404).json({ message: '话题不存在' });
  
  // 1. 获取所有回复并转换为普通对象
  let allReplies = topic.replies.map(r => r.toObject());
  const replyIds = allReplies.map(r => r._id.toString());

  // 2. 聚合查询所有回复的点赞数和评论数 (为了支持热度排序)
  // 即使是按时间排序，为了前端显示方便，我们也一并查出来，避免前端 N+1 请求
  const [likeCounts, commentCounts] = await Promise.all([
    Like.aggregate([
      { $match: { topicReplyId: { $in: replyIds } } },
      { $group: { _id: '$topicReplyId', count: { $sum: 1 } } }
    ]),
    Comment.aggregate([
      { $match: { topicReplyId: { $in: replyIds } } },
      { $group: { _id: '$topicReplyId', count: { $sum: 1 } } }
    ])
  ]);
  
  const likeMap = {};
  likeCounts.forEach(c => likeMap[c._id] = c.count);
  
  const commentMap = {};
  commentCounts.forEach(c => commentMap[c._id] = c.count);
  
  // 3. 将统计数据附加到回复对象上
  allReplies.forEach(r => {
    r.likeCount = likeMap[r._id.toString()] || 0;
    r.commentCount = commentMap[r._id.toString()] || 0;
    r.heat = r.likeCount + r.commentCount;
  });
  
  // 4. 执行排序
  if (sort === 'heat') {
    allReplies.sort((a, b) => {
      if (a.heat !== b.heat) return (a.heat - b.heat) * order;
      // 热度相同时，按时间排序
      return (new Date(a.createdAt) - new Date(b.createdAt)) * order; 
    });
  } else {
    // 按时间排序 (默认)
    allReplies.sort((a, b) => {
      return (new Date(a.createdAt) - new Date(b.createdAt)) * order;
    });
  }
  
  // 5. 分页截取
  const totalReplies = allReplies.length;
  const skipIndex = (page - 1) * limit;
  const paginatedReplies = allReplies.slice(skipIndex, skipIndex + limit);
  
  // 6. 同步用户信息 (仅针对当前页的数据)
  // 获取所有非匿名回复的 userId (包括可能被保存为字符串的旧数据，尝试转换)
  const userIds = paginatedReplies
    .filter(r => !r.isAnonymous && r.userId)
    .map(r => r.userId.toString()); // 确保转为字符串
    
  if (userIds.length > 0) {
    // 去重
    const uniqueUserIds = [...new Set(userIds)];
    const users = await User.find({ _id: { $in: uniqueUserIds } }, 'avatar nickname level');
    const userMap = {};
    users.forEach(u => userMap[u._id.toString()] = u);
    
    paginatedReplies.forEach(r => {
      // 只有非匿名且有 userId 的才同步
      if (!r.isAnonymous && r.userId && userMap[r.userId.toString()]) {
        const user = userMap[r.userId.toString()];
        r.avatar = user.avatar || r.avatar;
        r.author = user.nickname || r.author;
        r.authorLevel = user.level || 1; // 确保附加 level
      }
    });
  }
  
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
  console.log(`[Topic] Reply added to ${topic._id} by ${author}`);
  
  // 增加经验值 (话题回复 +5)
  if (!isAnonymous && userId) {
    addExperience(userId, 5);
  }

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