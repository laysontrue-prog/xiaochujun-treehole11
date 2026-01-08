const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  content: { type: String, required: true },
  author: { type: String, default: '匿名', index: true },
  authorAvatar: { type: String }, // 添加作者头像字段
  userId: { type: String, index: true }, // 添加用户ID字段，暂时移除required以兼容旧数据
  isAnonymous: { type: Boolean, default: true },
  status: { type: String, default: 'approved', enum: ['pending', 'approved', 'rejected', 'deleted'], index: true }, // 广场查询常用状态过滤
  hasSensitive: { type: Boolean, default: false }, // 是否包含敏感词
  images: [{ type: String }], // 存储图片URL或Base64
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true } // 排序常用索引
});

// 添加索引以提高查询性能
PostSchema.index({ status: 1, createdAt: -1 }); // 复合索引：用于按状态过滤并按创建时间排序

module.exports = mongoose.model('Post', PostSchema);