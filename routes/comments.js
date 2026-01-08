const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const notificationService = require('../utils/notificationService'); // 引入通知服务
const { uploadImage } = require('../utils/imageHandler');

const sensitiveFilter = require('../utils/sensitiveFilter'); 
const auth = require('../middleware/auth');

// 添加评论（树洞广场）
router.post('/post', auth, async (req, res) => {
  const { postId, content, isAnonymous = false, images = [] } = req.body;
  const author = isAnonymous ? '匿名' : (req.user.nickname || '用户');
  const userId = req.user.userId;

  // 获取作者头像
  let authorAvatar = '';
  const user = await require('../models/User').findById(userId);
  if (user) authorAvatar = user.avatar;

  // 处理图片上传
  let processedImages = [];
  if (images && Array.isArray(images) && images.length > 0) {
    try {
      processedImages = await Promise.all(images.map(img => uploadImage(img)));
      processedImages = processedImages.filter(img => img);
    } catch (err) {
      console.error('图片处理失败:', err);
      return res.status(400).json({ message: '图片上传失败: ' + err.message });
    }
  }

  const comment = new Comment({ 
    postId, 
    content, 
    author, 
    userId,
    authorAvatar, 
    images: processedImages 
  });
  await comment.save();
  
  // 更新帖子的评论数
  await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });
  
  // 获取帖子信息，生成通知给帖子作者
  const post = await Post.findById(postId);
  if (post && post.userId) {
    // 使用新的通知服务发送通知
    // 如果评论者不是帖子作者才发送通知
    // 注意：这里假设req.user存在，但在comments.js的这个接口中，req.user可能需要从auth中间件获取
    // 检查一下comments.js是否使用了auth中间件？
    // 目前看代码没有显式使用auth，author是直接传的字符串
    // 这是一个潜在问题，但为了保持现有功能，我们先尽量适配
    
    // 假设评论者ID无法获取（如果是匿名），则senderId为空
    
    // 发送回复通知
    if (post.userId.toString() !== (req.user ? req.user.userId : '')) {
       notificationService.send({
        userId: post.userId,
        type: 'reply',
        content: `${author} 回复了你的帖子`,
        relatedId: postId,
        senderName: author,
        detail: {
          postTitle: post.content.substring(0, 20) + '...',
          replyContent: content,
          hasImage: images && images.length > 0
        }
      });
    }
  }

  // 处理 @提及
  // 尝试获取当前用户ID，如果没有则为空
  const senderId = req.user ? req.user.userId : null;
  notificationService.handleMentions(content, postId, senderId, author, 'reply');
  
  res.json(comment);
});

// 添加评论（话题讨论回复）
router.post('/topic-reply', auth, async (req, res) => {
  const { topicReplyId, content, isAnonymous = false, images = [] } = req.body;
  const author = isAnonymous ? '匿名' : (req.user.nickname || '用户');
  const userId = req.user.userId;

  // 获取作者头像
  let authorAvatar = '';
  const user = await require('../models/User').findById(userId);
  if (user) authorAvatar = user.avatar;

  // 处理图片上传
  let processedImages = [];
  if (images && Array.isArray(images) && images.length > 0) {
    try {
      processedImages = await Promise.all(images.map(img => uploadImage(img)));
      processedImages = processedImages.filter(img => img);
    } catch (err) {
      console.error('图片处理失败:', err);
      return res.status(400).json({ message: '图片上传失败: ' + err.message });
    }
  }

  const comment = new Comment({ 
    topicReplyId, 
    content, 
    author, 
    userId,
    authorAvatar, 
    images: processedImages 
  });
  await comment.save();
  
  // 这里可以添加话题回复的通知逻辑
  // 由于话题回复没有独立的ID和作者信息，暂时简化处理
  
  res.json(comment);
});

// 获取树洞广场评论
router.get('/post/:postId', async (req, res) => {
  const comments = await Comment.find({ postId: req.params.postId })
    .populate('userId', 'avatar level nickname')
    .sort({ createdAt: -1 });
  
  const processedComments = comments.map(c => {
    const obj = c.toObject();
    if (obj.userId) {
      obj.authorAvatar = obj.userId.avatar || obj.authorAvatar;
      obj.author = obj.userId.nickname || obj.author;
      obj.userId = obj.userId._id;
    }
    return obj;
  });
  res.json(processedComments);
});

// 获取话题回复评论
router.get('/topic-reply/:topicReplyId', async (req, res) => {
  const comments = await Comment.find({ topicReplyId: req.params.topicReplyId })
    .populate('userId', 'avatar level nickname')
    .sort({ createdAt: -1 });

  const processedComments = comments.map(c => {
    const obj = c.toObject();
    if (obj.userId) {
      obj.authorAvatar = obj.userId.avatar || obj.authorAvatar;
      obj.author = obj.userId.nickname || obj.author;
      obj.userId = obj.userId._id;
    }
    return obj;
  });
  res.json(processedComments);
});

// 获取数量（点赞先模拟，评论用真实）
router.get('/count/post/:postId', async (req, res) => {
  const commentCount = await Comment.countDocuments({ postId: req.params.postId });
  res.json({ likeCount: 0, commentCount }); // 点赞后续加
});

module.exports = router;