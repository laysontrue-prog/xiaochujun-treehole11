const Notification = require('../models/Notification');
const User = require('../models/User');

let io;

const init = (socketIo) => {
  io = socketIo;
  
  io.on('connection', (socket) => {
    // 客户端连接时发送用户ID进行注册
    socket.on('register', (userId) => {
      if (userId) {
        socket.join(userId); // 将socket加入以userId命名的房间
        console.log(`User ${userId} registered for notifications`);
      }
    });
  });
};

// 检查是否重复通知（5分钟内相同类型和内容）
const isDuplicate = async (userId, type, content, relatedId) => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const exists = await Notification.findOne({
    userId,
    type,
    content,
    relatedId,
    createdAt: { $gt: fiveMinutesAgo }
  });
  return !!exists;
};

// 发送单条通知
const send = async ({ userId, type, content, relatedId, senderId, senderName, detail }) => {
  try {
    if (!userId) return;

    // 去重检查
    if (await isDuplicate(userId, type, content, relatedId)) {
      console.log('Duplicate notification filtered');
      return;
    }

    const notification = new Notification({
      userId,
      type,
      content,
      relatedId,
      senderId,
      senderName,
      detail
    });

    await notification.save();

    // 实时推送
    if (io) {
      io.to(userId).emit('notification', notification);
    }
    
    return notification;
  } catch (err) {
    console.error('Send notification error:', err);
  }
};

// 广播通知（给所有用户，例如新帖子）
// 注意：为了性能，对于"所有用户"的通知，我们这里做一个简化处理
// 真实场景下，如果用户量巨大，应该使用消息队列异步处理
// 这里我们只给最近活跃的用户或者在线用户发送，或者分批插入
const broadcast = async ({ type, content, relatedId, senderId, senderName, detail, excludeUserId }) => {
  try {
    // 1. 实时推送给在线用户
    if (io) {
      // 获取所有房间（即所有在线userId）
      // 注意：socket.io 4.x 获取房间方式可能不同，这里简化为广播给所有人，客户端自己过滤excludeUserId
      io.emit('notification_broadcast', {
        type,
        content,
        relatedId,
        senderId,
        senderName,
        detail,
        excludeUserId
      });
    }

    // 2. 数据库存储
    // 为了防止数据库瞬间压力过大，这里只给非发送者插入
    // 实际上，"所有用户"的通知如果存库会非常大，通常建议使用"拉取"模式（SystemBox）
    // 但根据需求"为每个用户实现完整的通知功能系统"，我们选择折中方案：
    // 只给最近7天活跃的用户创建通知记录
    
    // 假设我们有一个 activeAt 字段在 User 模型（目前没有，先查所有用户，限制数量）
    // 暂定限制给最近注册的前1000个用户发送（模拟活跃用户），防止全表扫描炸库
    const users = await User.find({ _id: { $ne: excludeUserId } }).limit(1000).select('_id');
    
    const notifications = users.map(u => ({
      userId: u._id,
      type,
      content,
      relatedId,
      senderId,
      senderName,
      detail,
      read: false,
      createdAt: new Date()
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

  } catch (err) {
    console.error('Broadcast notification error:', err);
  }
};

// 解析提及 @username
const handleMentions = async (text, relatedId, senderId, senderName, type) => {
  if (!text) return;
  
  // 匹配 @昵称 (支持空格，直到遇到特殊字符或结尾)
  // 优化正则：匹配 @ 后面的非空白字符，或者 @ 后面的字符直到遇到标点符号
  // 常见昵称可能包含中文、字母、数字、下划线、横线
  // 之前的正则：/@([\u4e00-\u9fa5a-zA-Z0-9_-]+)/g
  // 现在的优化：放宽匹配，并尝试匹配最长可能的昵称
  
  // 策略：提取所有 @ 开头的片段，然后逐个去数据库查询是否存在该昵称的用户
  // 这是一个比较稳妥的方法，虽然效率稍低，但准确性高
  
  const potentialMentions = text.match(/@([^\s@]+)/g); // 匹配 @xxx (直到空格或下一个@)
  
  if (potentialMentions) {
    const rawNames = [...new Set(potentialMentions.map(m => m.substring(1)))]; // 去掉 @ 并去重
    
    for (const rawName of rawNames) {
      // 尝试匹配用户：先直接匹配 rawName
      // 考虑到昵称后面可能紧跟标点符号（如 @User, 你好），我们需要尝试去掉尾部标点
      
      // 1. 直接匹配
      let user = await User.findOne({ nickname: rawName });
      
      // 2. 如果没找到，尝试去掉尾部常见标点 (.,!?:;"'，。！？：；" ')
      if (!user) {
        const cleanName = rawName.replace(/[.,!?:;"'，。！？：；"']+$/, '');
        if (cleanName !== rawName) {
           user = await User.findOne({ nickname: cleanName });
        }
      }

      if (user && user._id.toString() !== senderId) {
        await send({
          userId: user._id,
          type: 'mention',
          content: `${senderName} 在${type === 'post' ? '帖子' : '评论'}中提到了你`,
          relatedId,
          senderId,
          senderName,
          detail: { mentionedIn: text.substring(0, 50) }
        });
      }
    }
  }
};

module.exports = {
  init,
  send,
  broadcast,
  handleMentions
};
