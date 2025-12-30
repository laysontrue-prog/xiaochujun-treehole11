const mongoose = require('mongoose');

const ToolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  html: { type: String, required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tool', ToolSchema);