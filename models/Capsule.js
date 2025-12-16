const mongoose = require('mongoose');

const CapsuleSchema = new mongoose.Schema({
  author: { type: String, required: true }, // 昵称
  content: { type: String, required: true },
  unlockDate: { type: Date, required: true }, // 解封时间
  createdAt: { type: Date, default: Date.now },
  isUnlocked: { type: Boolean, default: false } // 是否已解封
});

module.exports = mongoose.model('Capsule', CapsuleSchema);