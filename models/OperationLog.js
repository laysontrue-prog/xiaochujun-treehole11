const mongoose = require('mongoose');

const OperationLogSchema = new mongoose.Schema({
  operatorId: { type: String, required: true }, // 操作人ID
  operatorName: { type: String, required: true }, // 操作人昵称
  targetId: { type: String, required: true }, // 目标对象ID (如Post ID)
  targetType: { type: String, required: true, default: 'Post' }, // 目标类型
  action: { type: String, required: true }, // 动作：'delete', 'update' 等
  reason: { type: String, required: true }, // 操作原因
  details: { type: Object }, // 备份被删除的内容或其他详情
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('OperationLog', OperationLogSchema);
