const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema({
  content: { type: String, required: true },
  author: { type: String, default: '匿名' },
  isAnonymous: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] } // 审核状态
});

const TopicSchema = new mongoose.Schema({
  title: { type: String, required: true }, // 话题标题
  description: { type: String }, // 描述
  icon: { type: String, default: '💬' }, // 小图标
  replies: [ReplySchema], // 回复列表
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Topic', TopicSchema);