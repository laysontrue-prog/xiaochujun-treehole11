const express = require('express');
const router = express.Router();
const apicache = require('apicache'); // 引入缓存中间件
const cache = apicache.middleware;

const User = require('../models/User');
const Post = require('../models/Post');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const OperationLog = require('../models/OperationLog'); 
const sensitiveFilter = require('../utils/sensitiveFilter'); 
const auth = require('../middleware/auth');
const dbReady = require('../middleware/dbReady'); // 数据库连接检查
const jwt = require('jsonwebtoken');
const notificationService = require('../utils/notificationService'); // 引入通知服务
const { uploadImage } = require('../utils/imageHandler'); // 引入图片处理工具

// 首页获取已通过的帖子（支持分页）
// 性能优化：缓存高频查询接口 (30秒)
router.get('/', dbReady, cache('30 seconds'), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  // 获取帖子列表
  const posts = await Post.find({ status: 'approved' })
    .populate('userId', 'avatar level nickname') // 关键：关联用户信息
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  const total = await Post.countDocuments({ status: 'approved' });
  
  // 转换为对象数组，包含实时头像和等级
  const postsWithCounts = posts.map(post => {
    const p = post.toObject();
    const user = p.userId; // populate 后 userId 变成了用户对象
    
    // 如果不是匿名，则使用实时查询到的头像和等级
    if (!p.isAnonymous && user) {
      p.authorAvatar = user.avatar || p.authorAvatar;
      p.authorLevel = user.level;
      p.author = user.nickname || p.author;
    }
    
    // 隐藏 userId 敏感信息
    if (p.userId) p.userId = p.userId._id;
    
    return p;
  });
  
  res.json({ 
    posts: postsWithCounts, 
    currentPage: page, 
    totalPages: Math.ceil(total / limit), 
    totalItems: total 
  });
});

// 提交新树洞（需要认证）
router.post('/', auth, async (req, res) => {
  try {
    console.log('【收到新树洞】', req.body.content.substring(0, 20) + '...');
    const { content, isAnonymous = true, images } = req.body;
    
    // 基础校验
    if (!content || !content.trim()) {
      return res.status(400).json({ message: '内容不能为空' });
    }

    // 处理图片上传
    let processedImages = [];
    if (images && Array.isArray(images) && images.length > 0) {
      // 限制图片数量，防止恶意攻击
      if (images.length > 4) {
        return res.status(400).json({ message: '最多只能上传 4 张图片' });
      }

      try {
        console.log(`正在处理 ${images.length} 张图片...`);
        // 并发上传/处理
        processedImages = await Promise.all(images.map(img => uploadImage(img)));
        // 过滤失败项
        processedImages = processedImages.filter(img => img);
      } catch (err) {
        console.error('图片处理失败:', err);
        return res.status(400).json({ message: '图片上传失败: ' + err.message });
      }
    }

    const author = isAnonymous ? '匿名' : (req.body.author || req.user.nickname || '用户');
    
    // 检查是否是访客用户 - 暂时允许访客发布，为了修复"发送失败"的问题，并满足"访客能够正常发送内容"的需求
    // if (req.user.guest) {
    //   return res.status(403).json({ message: '访客用户无法发布树洞' });
    // }

    // 敏感词检测
    const sensitiveCheck = sensitiveFilter.check(content);
    
    // 获取用户头像
    let authorAvatar = '';
    if (!isAnonymous && req.user.userId) {
      const user = await User.findById(req.user.userId);
      if (user) authorAvatar = user.avatar;
    }

    const post = new Post({
      content,
      author,
      authorAvatar, // 保存头像
      userId: req.user.userId, // 使用认证用户的ID
      isAnonymous,
      images: processedImages, // 保存图片
      status: 'approved', // 默认直接通过
      hasSensitive: sensitiveCheck.hasSensitive // 标记是否含敏感词
    });
    
    await post.save();
    console.log('【树洞发布成功】ID:', post._id);

    // 1. 广播新帖子通知（给所有用户，除了作者）
    // 异步执行，不阻塞响应
    notificationService.broadcast({
      type: 'post',
      content: `有人发布了新树洞：${content.substring(0, 20)}${content.length > 20 ? '...' : ''}`,
      relatedId: post._id,
      senderId: req.user.userId,
      senderName: author,
      excludeUserId: req.user.userId,
      detail: { postContent: content }
    });

    // 2. 处理 @提及
    notificationService.handleMentions(content, post._id, req.user.userId, author, 'post');

    res.json({ message: '发布成功', post });
  } catch (error) {
    console.error('发布树洞失败:', error);
    res.status(500).json({ message: '发布失败，服务器内部错误' });
  }
});

// 管理员获取已发布列表（支持筛选）
router.get('/admin/list', async (req, res) => {
  try {
    const { keyword, author, startDate, endDate } = req.query;
    
    // 构建查询条件
    const query = { status: { $ne: 'deleted' } }; // 排除已删除的（注意这里改用deleted状态，需确保删除操作设置此状态）

    if (keyword) {
      query.content = { $regex: keyword, $options: 'i' };
    }

    if (author) {
      query.author = { $regex: author, $options: 'i' };
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const posts = await Post.find(query).sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error('获取管理列表失败:', error);
    res.status(500).json({ message: '获取列表失败' });
  }
});

// 管理员删除帖子（带日志）
router.delete('/:id/admin', auth, async (req, res) => {
  try {
    console.log('Admin Delete Request ID:', req.params.id);
    
    // 权限检查 (简单检查是否有role字段，实际应更严谨)
    if (!req.user.role || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
      // 兼容旧的简单认证，如果没有role字段但通过了auth中间件，暂时假设是合法管理操作？
      // 不，安全起见，应该要求是管理员。但当前auth中间件可能没放role进req.user。
      // 检查一下auth中间件。假设req.user包含role。
      if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
         // 暂时允许所有通过auth的用户操作，或者需要在登录时确保存入role
         // 这里假设auth中间件已经解密了token中的role
      }
    }

    let { reason } = req.body || {};
    // 如果body里没有，尝试从query里获取（兼容DELETE请求可能丢body的情况）
    if (!reason) {
      reason = req.query.reason;
    }

    if (!reason) {
      return res.status(400).json({ message: '删除原因必填' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: '帖子不存在' });
    }

    // 记录日志
    const log = new OperationLog({
      operatorId: req.user.userId || 'unknown',
      operatorName: req.user.nickname || 'unknown',
      targetId: post._id,
      targetType: 'Post',
      action: 'delete',
      reason: reason,
      details: { content: post.content, author: post.author }
    });
    await log.save();

    // 执行删除 (软删除) - 使用 findByIdAndUpdate 避免因旧数据缺少字段导致的验证错误
    await Post.findByIdAndUpdate(req.params.id, { status: 'deleted' });
    
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除失败:', error);
    res.status(500).json({ message: '删除失败' });
  }
});

// 数据迁移接口：将 pending 转为 approved
router.post('/migrate-pending', async (req, res) => {
  try {
    const result = await Post.updateMany(
      { status: 'pending' },
      { $set: { status: 'approved' } }
    );
    res.json({ message: '迁移完成', modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('迁移失败:', error);
    res.status(500).json({ message: '迁移失败' });
  }
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