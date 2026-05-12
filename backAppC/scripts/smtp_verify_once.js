/**
 * Uso: node scripts/smtp_verify_once.js
 * Comprueba credenciales SMTP (no envía correo).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const dns = require('dns');
const nodemailer = require('nodemailer');

function trimEnv(val) {
  if (val == null) return '';
  let s = String(val).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const host = trimEnv(process.env.SMTP_HOST);
const user = trimEnv(process.env.SMTP_USER);
const pass = trimEnv(process.env.SMTP_PASS);
const port = parseInt(process.env.SMTP_PORT || '587', 10);
const secure = process.env.SMTP_SECURE === 'true';
const smtpIpv4 =
  process.env.SMTP_IPV4 === '1' || process.env.SMTP_IPV4 === 'true';

if (smtpIpv4 && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const transportOpts = {
  host,
  port,
  secure,
  requireTLS: !secure && port === 587,
  auth: { user, pass }
};
if (smtpIpv4) {
  transportOpts.allowInternalNetworkInterfaces = true;
}

const t = nodemailer.createTransport(transportOpts);

t.verify()
  .then(() => {
    console.error('SMTP verify: OK');
    process.exit(0);
  })
  .catch((e) => {
    console.error('SMTP verify:', e.message);
    process.exit(1);
  });
