const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (token) {
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
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  try {
    // 1. Guest Login
    console.log('--- Guest Login ---');
    const guestRes = await post('/api/auth/guest', {});
    console.log('Guest Login:', guestRes.status, guestRes.body);
    const guestToken = guestRes.body.token;

    // 2. Post as Guest (Should fail with 403, not 401)
    console.log('\n--- Post as Guest ---');
    const guestPostRes = await post('/api/posts', { content: 'Guest post' }, guestToken);
    console.log('Guest Post:', guestPostRes.status, guestPostRes.body);

    // 3. Register New User
    console.log('\n--- Register New User ---');
    const studentId = 'testuser_' + Date.now();
    const registerRes = await post('/api/auth/register', {
      studentId: studentId,
      nickname: 'TestUser',
      password: 'password123'
    });
    console.log('Register:', registerRes.status, registerRes.body);
    const userToken = registerRes.body.token;

    // 4. Post as New User (Should succeed)
    console.log('\n--- Post as New User ---');
    const userPostRes = await post('/api/posts', { content: 'User post', isAnonymous: false }, userToken);
    console.log('User Post:', userPostRes.status, userPostRes.body);

  } catch (e) {
    console.error(e);
  }
}

run();
