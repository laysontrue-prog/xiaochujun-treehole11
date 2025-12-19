const express = require('express');
const router = express.Router();
const Like = require('../models/Like');
const Post = require('../models/Post');
const Notification = require('../models/Notification');

// 点赞（防止重复）
router.post('/', async (req, res) => {
  const { postId, topicReplyId, userNickname } = req.body;
  const existing = await Like.findOne({ postId, topicReplyId, userNickname });
  if (existing) return res.json({ message: '已点赞' });

  const like = new Like({ postId, topicReplyId, userNickname });
  await like.save();
  
  // 更新帖子的点赞数
  if (postId) {
    await Post.findByIdAndUpdate(postId, { $inc: { likeCount: 1 } });
    
    // 生成通知
    const post = await Post.findById(postId);
    if (post && post.userId) {
      const notification = new Notification({
        userId: post.userId, // 使用帖子的userId作为通知的接收者
        type: 'like',
        content: `${userNickname} 点赞了你的帖子`,
        detail: {
          postTitle: post.content.substring(0, 20) + '...',
          likeUser: userNickname
        }
      });
      await notification.save();
    }
  }
  
  res.json({ message: '点赞成功' });
});

// 获取点赞数
router.get('/post/:postId', async (req, res) => {
  const count = await Like.countDocuments({ postId: req.params.postId });
  res.json({ count });
});

router.get('/topic-reply/:topicReplyId', async (req, res) => {
  const count = await Like.countDocuments({ topicReplyId: req.params.topicReplyId });
  res.json({ count });
});

// 检查用户是否已点赞（单个）
router.get('/check', async (req, res) => {
  const { postId, topicReplyId, userNickname } = req.query;
  const existing = await Like.findOne({ postId, topicReplyId, userNickname });
  res.json({ isLiked: !!existing });
});

// 批量检查用户是否已点赞（多个帖子）
router.post('/check-multiple', async (req, res) => {
  const { postIds, topicReplyIds, userNickname } = req.body;
  
  // 构建查询条件
  const query = {
    userNickname
  };
  
  if (postIds && postIds.length > 0) {
    query.postId = { $in: postIds };
  } else if (topicReplyIds && topicReplyIds.length > 0) {
    query.topicReplyId = { $in: topicReplyIds };
  }
  
  // 查询所有匹配的点赞记录
  const likes = await Like.find(query);
  
  // 构建结果Map
  const result = {
    postLikes: new Map(),
    topicReplyLikes: new Map()
  };
  
  likes.forEach(like => {
    if (like.postId) {
      result.postLikes.set(like.postId.toString(), true);
    } else if (like.topicReplyId) {
      result.topicReplyLikes.set(like.topicReplyId, true);
    }
  });
  
  res.json({
    postLikes: Object.fromEntries(result.postLikes),
    topicReplyLikes: Object.fromEntries(result.topicReplyLikes)
  });
});

// 取消点赞
router.delete('/', async (req, res) => {
  const { postId, topicReplyId, userNickname } = req.body;
  await Like.deleteOne({ postId, topicReplyId, userNickname });
  
  // 更新帖子的点赞数
  if (postId) {
    await Post.findByIdAndUpdate(postId, { $inc: { likeCount: -1 } });
  }
  
  res.json({ message: '取消点赞成功' });
});

module.exports = router;