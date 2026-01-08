const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true, index: true }, // 添加索引提升登录速度
  nickname: { type: String, required: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
  avatar: { type: String, default: '' }, // 用户头像URL
  avatarHistory: [{ type: String }], // 头像历史记录
  // 等级系统字段
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  lastCheckIn: { type: Date },
  consecutiveCheckIns: { type: Number, default: 0 },
  checkInHistory: [{ type: Date }], // 记录签到日期
  createdAt: { type: Date, default: Date.now }
});

// 正确写法：pre save 中间件
UserSchema.pre('save', async function () {
  if (this.isModified('password')) {
    // 降低 salt rounds 到 8，在保证安全的同时大幅提升登录验证速度（尤其在弱 CPU 环境下）
    this.password = await bcrypt.hash(this.password, 8);
  }
});

// 比对密码
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);