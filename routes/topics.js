const express = require('express');
const router = express.Router();
const Topic = require('../models/Topic');

// 获取所有话题列表（支持分页）
router.get('/', async (req, res) => {
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
  
  // 计算回复总数
  const totalReplies = topic.replies.length;
  
  // 对回复进行分页
  const paginatedReplies = topic.replies.slice(skip, skip + limit);
  
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
router.post('/:id/reply', async (req, res) => {
  const { content, author = '匿名', isAnonymous = true } = req.body;
  const topic = await Topic.findById(req.params.id);
  if (!topic) return res.status(404).json({ message: '话题不存在' });

  topic.replies.push({ content, author: isAnonymous ? '匿名' : author, isAnonymous });
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