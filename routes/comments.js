const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');

// 添加评论（树洞广场）
router.post('/post', async (req, res) => {
  const { postId, content, author = '匿名' } = req.body;
  const comment = new Comment({ postId, content, author });
  await comment.save();
  res.json(comment);
});

// 添加评论（话题讨论回复）
router.post('/topic-reply', async (req, res) => {
  const { topicReplyId, content, author = '匿名' } = req.body;
  const comment = new Comment({ topicReplyId, content, author });
  await comment.save();
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