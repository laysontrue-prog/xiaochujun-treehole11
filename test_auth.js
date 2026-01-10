const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '.env') });

const secret = process.env.JWT_SECRET;
console.log('Secret from env:', secret);

const middleware = require('./middleware/auth');

// Mock request and response
const req = {
    header: (name) => {
        if (name === 'x-auth-token') return null;
        if (name === 'Authorization') return 'Bearer ' + token;
        return null;
    }
};

const res = {
    status: (code) => {
        console.log('Status:', code);
        return {
            json: (data) => console.log('Response:', data)
        };
    }
};

const next = () => console.log('Next called (Success)');

// Test 1: Generate token as if registered
console.log('\n--- Test 1: New User Token ---');
const tokenPayload = { userId: '123', nickname: 'NewUser', role: 'student' };
var token = jwt.sign(tokenPayload, secret, { expiresIn: '7d' });
console.log('Generated Token:', token);

// Verify with middleware
middleware(req, res, next);

// Test 2: Generate token as guest
console.log('\n--- Test 2: Guest Token ---');
const guestPayload = { guest: true };
token = jwt.sign(guestPayload, secret, { expiresIn: '1d' });
console.log('Generated Guest Token:', token);

middleware(req, res, next);

// Test 3: Verify with default key (simulation of missing env in middleware)
console.log('\n--- Test 3: Verify with Wrong Secret ---');
// Temporarily unset env to see what happens if middleware uses default
const originalSecret = process.env.JWT_SECRET;
delete process.env.JWT_SECRET;

try {
    middleware(req, res, next);
} catch (e) {
    console.log('Error:', e);
}

// Restore
process.env.JWT_SECRET = originalSecret;
