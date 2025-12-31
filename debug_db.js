const mongoose = require('mongoose');
const Post = require('./models/Post');

const MONGO_URI = 'mongodb+srv://laysontrue_db_user:CLC123123123@cluster0.njszzed.mongodb.net/treehole?retryWrites=true&w=majority';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    // Get last 5 posts
    const posts = await Post.find({}).sort({ createdAt: -1 }).limit(5);
    
    posts.forEach((p, i) => {
      console.log(`[${i}] ID: ${p._id}`);
      console.log(`     Status: ${p.status}`);
      console.log(`     Author: ${p.author}`);
      console.log(`     UserId: ${p.userId}`);
      console.log(`     CreatedAt: ${p.createdAt}`);
      console.log(`     Content: ${p.content}`);
      console.log('-----------------------------------');
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
