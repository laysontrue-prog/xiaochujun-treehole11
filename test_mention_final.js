const http = require('http');

function request(options, body, token) {
  return new Promise((resolve, reject) => {
    if (token) {
      options.headers = options.headers || {};
      options.headers['Authorization'] = 'Bearer ' + token;
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
      });
    });
    req.on('error', (e) => reject(e));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('--- Mention Notification Test (Punctuation) ---');

  // 1. Register User A (Mentioned)
  const nameA = 'MentionTarget' + Math.floor(Math.random() * 1000);
  console.log(`1. Registering User A (${nameA})...`);
  const resA = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { studentId: 'ment_a_' + Date.now(), nickname: nameA, password: '123' });
  const tokenA = resA.body.token;
  const userIdA = JSON.parse(Buffer.from(tokenA.split('.')[1], 'base64').toString()).userId;
  console.log(`User A ID: ${userIdA}`);

  // 2. Register User B (Sender)
  console.log('2. Registering User B (Sender)...');
  const resB = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { studentId: 'ment_b_' + Date.now(), nickname: 'SenderUser', password: '123' });
  const tokenB = resB.body.token;

  // 3. User B mentions User A in a post (with punctuation)
  console.log(`3. User B posting with mention "@${nameA}, hello!"...`);
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/posts',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { content: `Hey @${nameA}, check this out!`, isAnonymous: false }, tokenB);

  // Wait a bit
  await new Promise(r => setTimeout(r, 1000));

  // 4. Check User A notifications
  console.log('4. Checking User A notifications...');
  const notifRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications',
    method: 'GET'
  }, null, tokenA);

  const notifications = notifRes.body.notifications;
  const mentionNotif = notifications.find(n => n.type === 'mention');
  
  if (mentionNotif) {
    console.log('✅ Mention notification received:', mentionNotif.content);
  } else {
    console.log('❌ No mention notification found!');
    console.log('All notifications:', notifications);
  }
}

run();