const express = require('express');
const router = express.Router();
const Tool = require('../models/Tool');
const auth = require('../middleware/auth');

// 中间件：验证审核员权限
const verifyModerator = (req, res, next) => {
  if (req.user.role !== 'moderator' && req.user.role !== 'admin') {
    return res.status(403).json({ message: '权限不足，仅审核员可执行此操作' });
  }
  next();
};

// 获取所有工具
router.get('/', async (req, res) => {
  try {
    const tools = await Tool.find().populate('creator', 'nickname');
    res.json(tools);
  } catch (err) {
    console.error('获取工具列表错误：', err.message);
    res.status(500).json({ message: '获取工具列表失败' });
  }
});

// 获取单个工具
router.get('/:id', async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id).populate('creator', 'nickname');
    if (!tool) {
      return res.status(404).json({ message: '工具不存在' });
    }
    res.json(tool);
  } catch (err) {
    console.error('获取工具详情错误：', err.message);
    res.status(500).json({ message: '获取工具详情失败' });
  }
});

// 创建工具
router.post('/', auth, async (req, res) => {
  const { name, html } = req.body;
  
  try {
    const newTool = new Tool({
      name,
      html,
      creator: req.user.userId
    });
    
    await newTool.save();
    console.log(`用户 ${req.user.nickname} 创建了工具：${name}`);
    
    res.json({ message: '工具创建成功', tool: newTool });
  } catch (err) {
    console.error('创建工具错误：', err.message);
    res.status(500).json({ message: '创建工具失败' });
  }
});

// 删除工具 - 仅审核员可操作
router.delete('/:id', [auth, verifyModerator], async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id);
    if (!tool) {
      return res.status(404).json({ message: '工具不存在' });
    }
    
    await Tool.findByIdAndDelete(req.params.id);
    
    // 记录删除操作日志
    console.log(`审核员 ${req.user.nickname} 删除了工具：${tool.name} (ID: ${req.params.id})`);
    
    res.json({ message: '工具删除成功' });
  } catch (err) {
    console.error('删除工具错误：', err.message);
    res.status(500).json({ message: '删除工具失败' });
  }
});

module.exports = router;