const crypto = require('crypto');

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw), 'utf8').digest('hex');
}

module.exports = { hashToken };
