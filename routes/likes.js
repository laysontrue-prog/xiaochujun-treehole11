const express = require('express');
const router = express.Router();
const Like = require('../models/Like');

// 点赞（防止重复）
router.post('/', async (req, res) => {
  const { postId, topicReplyId, userNickname } = req.body;
  const existing = await Like.findOne({ postId, topicReplyId, userNickname });
  if (existing) return res.json({ message: '已点赞' });

  const like = new Like({ postId, topicReplyId, userNickname });
  await like.save();
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

module.exports = router;