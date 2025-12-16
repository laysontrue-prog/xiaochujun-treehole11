const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

// 首页获取已通过的帖子
router.get('/', async (req, res) => {
  const posts = await Post.find({ status: 'approved' }).sort({ createdAt: -1 });
  res.json(posts);
});

// 提交新树洞
router.post('/', async (req, res) => {
  console.log('【收到新树洞】', req.body);   // ← 新增这行
  const { content, author = '匿名', isAnonymous = true } = req.body;
  const post = new Post({
    content,
    author: isAnonymous ? '匿名' : author,
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

module.exports = router;