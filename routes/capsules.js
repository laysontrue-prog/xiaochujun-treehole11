const express = require('express');
const router = express.Router();
const Capsule = require('../models/Capsule');

// 创建胶囊
router.post('/', async (req, res) => {
  const { author, content, unlockDate } = req.body;
  const capsule = new Capsule({ author, content, unlockDate });
  await capsule.save();
  res.json({ message: '胶囊已埋下，等待未来开启～' });
});

// 获取我的胶囊
router.get('/my', async (req, res) => {
  const { author } = req.query;
  const now = new Date();
  const capsules = await Capsule.find({ author }).sort({ createdAt: -1 });

  capsules.forEach(async c => {
    if (c.unlockDate <= now && !c.isUnlocked) {
      c.isUnlocked = true;
      await c.save();
    }
  });

  res.json(capsules);
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