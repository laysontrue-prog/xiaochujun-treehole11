const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }, // 树洞广场用
  topicReplyId: { type: String }, // 话题回复用
  content: { type: String, required: true },
  images: [{ type: String }], // 支持图片
  author: { type: String, default: '匿名' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 建立与用户的实时关联
  authorAvatar: { type: String }, // 冗余存储，用于匿名或快速加载
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comment', CommentSchema);