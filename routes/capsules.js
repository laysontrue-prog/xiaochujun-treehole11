const express = require('express');
const router = express.Router();
const Capsule = require('../models/Capsule');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// 创建胶囊
router.post('/', auth, async (req, res) => {
  try {
    const { content, unlockDate } = req.body;
    const author = req.user.nickname;
    const userId = req.user.userId;
    
    const capsule = new Capsule({ 
      author, 
      userId, 
      content, 
      unlockDate 
    });
    await capsule.save();
    res.json({ message: '胶囊已埋下，等待未来开启～' });
  } catch (error) {
    console.error('创建胶囊失败:', error);
    res.status(500).json({ message: '创建失败' });
  }
});

// 获取我的胶囊
router.get('/my', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    
    // 1. 批量查询，提升性能
    const capsules = await Capsule.find({ 
      $or: [{ userId: userId }, { author: req.user.nickname }] 
    }).sort({ createdAt: -1 });

    // 2. 识别需要解锁的胶囊（不再在循环中 await save，改用批量操作）
    const toUnlock = capsules.filter(c => c.unlockDate <= now && !c.isUnlocked);
    
    if (toUnlock.length > 0) {
      const unlockIds = toUnlock.map(c => c._id);
      
      // 批量更新解锁状态
      await Capsule.updateMany(
        { _id: { $in: unlockIds } },
        { $set: { isUnlocked: true } }
      );

      // 批量创建通知
      const notifications = toUnlock.map(c => ({
        userId: userId,
        type: 'capsule',
        title: '胶囊开启通知',
        content: '您的时间胶囊已到期，快去看看吧！',
        relatedId: c._id,
        detail: {
          capsuleContent: c.content.substring(0, 50) + '...'
        }
      }));
      await Notification.insertMany(notifications);
      
      // 更新内存中的状态以立即返回给前端
      toUnlock.forEach(c => c.isUnlocked = true);
    }

    res.json(capsules);
  } catch (error) {
    console.error('[Capsule API Error]:', error);
    res.status(500).json({ 
      message: '加载失败', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// 老师查看所有胶囊
router.get('/all', async (req, res) => {
  const capsules = await Capsule.find().sort({ createdAt: -1 });
  res.json(capsules);
});

// 新增：老师删除胶囊
router.delete('/:id', async (req, res) => {
  await Capsule.findByIdAndDelete(req.params.id);
  res.json({ message: '胶囊已删除' });
});

module.exports = router;