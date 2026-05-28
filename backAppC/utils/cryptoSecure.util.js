const crypto = require('crypto');

function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function timingSafeEqualHex(a, b) {
  if (!a || !b) return false;
  const na = String(a).trim().toLowerCase();
  const nb = String(b).trim().toLowerCase();
  if (na.length !== nb.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(na, 'hex'), Buffer.from(nb, 'hex'));
  } catch {
    return false;
  }
}

module.exports = {
  timingSafeEqualString,
  timingSafeEqualHex
};
