const mongoose = require('mongoose');

const LikeSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }, // 树洞广场用
  topicReplyId: { type: String }, // 话题回复用（字符串ID）
  userNickname: { type: String, required: true } // 用昵称防止重复点赞
});

// 添加索引以提高查询性能
LikeSchema.index({ postId: 1, userNickname: 1 }, { unique: true }); // 防止重复点赞
LikeSchema.index({ topicReplyId: 1, userNickname: 1 }, { unique: true }); // 防止话题回复重复点赞
LikeSchema.index({ postId: 1 }); // 用于快速统计帖子点赞数
LikeSchema.index({ topicReplyId: 1 }); // 用于快速统计话题回复点赞数

module.exports = mongoose.model('Like', LikeSchema);