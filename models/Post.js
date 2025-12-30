const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  content: { type: String, required: true },
  author: { type: String, default: '匿名' },
  userId: { type: String, required: true }, // 添加用户ID字段
  isAnonymous: { type: Boolean, default: true },
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// 添加索引以提高查询性能
PostSchema.index({ status: 1, createdAt: -1 }); // 复合索引：用于按状态过滤并按创建时间排序
PostSchema.index({ userId: 1 }); // 用户ID索引：用于查询用户的帖子
PostSchema.index({ _id: 1 }); // ID索引：用于快速查询单个帖子

module.exports = mongoose.model('Post', PostSchema);