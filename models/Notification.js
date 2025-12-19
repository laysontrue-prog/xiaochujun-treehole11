const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['reply', 'like', 'capsule'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  detail: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', NotificationSchema);
