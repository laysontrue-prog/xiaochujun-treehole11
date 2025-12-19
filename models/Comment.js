const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }, // 树洞广场用
  topicReplyId: { type: String }, // 话题回复用（因为话题回复没有独立ID，用字符串模拟）
  content: { type: String, required: true },
  author: { type: String, default: '匿名' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comment', CommentSchema);