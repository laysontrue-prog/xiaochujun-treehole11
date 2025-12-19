const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');

// 首页获取已通过的帖子（支持分页）
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  // 获取帖子列表（直接包含likeCount和commentCount字段）
  const posts = await Post.find({ status: 'approved' })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  const total = await Post.countDocuments({ status: 'approved' });
  
  // 转换为对象数组，包含所有必要字段
  const postsWithCounts = posts.map(post => ({
    ...post.toObject()
  }));
  
  res.json({ 
    posts: postsWithCounts, 
    currentPage: page, 
    totalPages: Math.ceil(total / limit), 
    totalItems: total 
  });
});

// 提交新树洞（需要认证）
router.post('/', auth, async (req, res) => {
  console.log('【收到新树洞】', req.body);   // ← 新增这行
  const { content, isAnonymous = true } = req.body;
  const author = isAnonymous ? '匿名' : (req.body.author || req.user.nickname || '用户');
  
  // 检查是否是访客用户
  if (req.user.guest) {
    return res.status(403).json({ message: '访客用户无法发布树洞' });
  }
  
  const post = new Post({
    content,
    author,
    userId: req.user.userId, // 使用认证用户的ID
    isAnonymous
  });
  await post.save();
  res.json({ message: '提交成功，待老师审核', post });
});

// 老师查看待审核列表
router.get('/pending', async (req, res) => {
  const posts = await Post.find({ status: 'pending' }).sort({ createdAt: -1 });
  res.json(posts);
});

// 老师通过
router.put('/:id/approve', async (req, res) => {
  await Post.findByIdAndUpdate(req.params.id, { status: 'approved' });
  res.json({ message: '已通过' });
});

// 老师拒绝
router.put('/:id/reject', async (req, res) => {
  await Post.findByIdAndUpdate(req.params.id, { status: 'rejected' });
  res.json({ message: '已拒绝' });
});

// 批量获取点赞数和评论数
router.get('/counts', async (req, res) => {
  const { postIds } = req.query;
  
  if (!postIds) {
    return res.status(400).json({ message: 'postIds is required' });
  }
  
  const ids = Array.isArray(postIds) ? postIds : [postIds];
  
  // 直接从Post模型获取likeCount和commentCount字段
  const posts = await Post.find(
    { _id: { $in: ids } },
    { likeCount: 1, commentCount: 1, _id: 1 }
  );
  
  // 构建结果
  const result = {};
  posts.forEach(post => {
    result[post._id] = {
      likeCount: post.likeCount || 0,
      commentCount: post.commentCount || 0
    };
  });
  
  // 确保返回所有请求的postId，即使数据库中不存在
  ids.forEach(id => {
    if (!result[id]) {
      result[id] = { likeCount: 0, commentCount: 0 };
    }
  });
  
  res.json(result);
});

// 获取已通过帖子的总数
router.get('/total', async (req, res) => {
  try {
    const total = await Post.countDocuments({ status: 'approved' });
    res.json({ total });
  } catch (error) {
    console.error('获取帖子总数失败:', error);
    res.status(500).json({ message: '获取帖子总数失败' });
  }
});

module.exports = router;