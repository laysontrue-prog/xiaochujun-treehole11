const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Notification = require('../models/Notification');

// 添加评论（树洞广场）
router.post('/post', async (req, res) => {
  const { postId, content, author = '匿名' } = req.body;
  const comment = new Comment({ postId, content, author });
  await comment.save();
  
  // 更新帖子的评论数
  await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });
  
  // 获取帖子信息，生成通知给帖子作者
  const post = await Post.findById(postId);
  if (post && post.userId) {
    const notification = new Notification({
      userId: post.userId, // 使用帖子的userId作为通知的接收者
      type: 'reply',
      content: `${author} 回复了你的帖子`,
      detail: {
        postTitle: post.content.substring(0, 20) + '...',
        replyContent: content,
        replyUser: author
      }
    });
    await notification.save();
  }
  
  res.json(comment);
});

// 添加评论（话题讨论回复）
router.post('/topic-reply', async (req, res) => {
  const { topicReplyId, content, author = '匿名' } = req.body;
  const comment = new Comment({ topicReplyId, content, author });
  await comment.save();
  
  // 这里可以添加话题回复的通知逻辑
  // 由于话题回复没有独立的ID和作者信息，暂时简化处理
  
  res.json(comment);
});

// 获取树洞广场评论
router.get('/post/:postId', async (req, res) => {
  const comments = await Comment.find({ postId: req.params.postId }).sort({ createdAt: -1 });
  res.json(comments);
});

// 获取话题回复评论
router.get('/topic-reply/:topicReplyId', async (req, res) => {
  const comments = await Comment.find({ topicReplyId: req.params.topicReplyId }).sort({ createdAt: -1 });
  res.json(comments);
});

// 获取数量（点赞先模拟，评论用真实）
router.get('/count/post/:postId', async (req, res) => {
  const commentCount = await Comment.countDocuments({ postId: req.params.postId });
  res.json({ likeCount: 0, commentCount }); // 点赞后续加
});

module.exports = router;