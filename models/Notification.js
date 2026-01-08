const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true // 索引优化查询
  },
  type: {
    type: String,
    enum: ['post', 'reply', 'like', 'mention', 'capsule', 'system'], // 增加 post, mention, system
    required: true
  },
  content: {
    type: String,
    required: true
  },
  relatedId: { // 关联内容的ID（帖子ID、评论ID等）
    type: String,
    required: false
  },
  senderId: { // 发送者ID
    type: String,
    required: false
  },
  senderName: { // 发送者昵称
    type: String,
    required: false
  },
  read: {
    type: Boolean,
    default: false,
    index: true // 索引优化未读查询
  },
  detail: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true, // 索引优化排序
    expires: 7776000 // 自动归档/删除策略：90天 (60*60*24*90)
  }
});

// 复合索引：查询某用户的未读通知，按时间倒序
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
