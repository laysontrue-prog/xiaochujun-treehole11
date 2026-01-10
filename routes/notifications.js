const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// 获取用户的通知列表（支持分页和筛选）
router.get('/', auth, async (req, res) => {
  const userId = req.user.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const type = req.query.type; // 支持按类型筛选
  const filter = { userId };
  
  if (type) {
    if (type === 'unread') {
      filter.read = false;
    } else {
      filter.type = type;
    }
  }
  
  try {
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ userId, read: false });
    
    res.json({
      notifications,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      unreadCount
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 获取未读数量
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.userId, read: false });
    res.json({ count });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 标记单个通知为已读
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: '通知不存在' });
    }
    
    // 确保只有通知的所有者才能标记为已读
    if (notification.userId !== req.user.userId) {
      return res.status(403).json({ message: '没有权限操作此通知' });
    }
    
    notification.read = true;
    await notification.save();
    
    res.json(notification);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 标记所有通知为已读
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.userId, read: false },
      { $set: { read: true } }
    );
    
    res.json({ message: '所有通知已标记为已读' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 清空所有通知
router.delete('/clear-all', auth, async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user.userId });
    
    res.json({ message: '所有通知已清空' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 兼容旧路由：清空所有通知
router.delete('/all', auth, async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user.userId });
    
    res.json({ message: '所有通知已清空' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

module.exports = router;
