const mongoose = require('mongoose');

const LikeSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }, // 树洞广场用
  topicReplyId: { type: String }, // 话题回复用（字符串ID）
  userNickname: { type: String, required: true } // 用昵称防止重复点赞
});

module.exports = mongoose.model('Like', LikeSchema);