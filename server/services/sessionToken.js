const crypto = require('crypto');

// Only a SHA-256 fingerprint of each session token is stored, so a leaked
// sessions table or backup cannot be replayed as live logins.
const hashSessionToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

module.exports = { hashSessionToken };
