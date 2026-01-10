const jwt = require('jsonwebtoken');

try {
    const token = jwt.sign({ foo: 'bar' }, undefined);
    console.log('Signed with undefined secret:', token);
} catch (e) {
    console.log('Error signing with undefined secret:', e.message);
}
