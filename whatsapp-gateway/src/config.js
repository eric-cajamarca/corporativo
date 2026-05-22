require('dotenv').config();
const path = require('path');

module.exports = {
  port: Number(process.env.PORT) || 3010,
  apiKey: process.env.GATEWAY_API_KEY || '',
  sessionsDir: path.resolve(process.env.SESSIONS_DIR || path.join(__dirname, '..', 'sessions')),
  logLevel: process.env.LOG_LEVEL || 'warn',
  sendMinIntervalMs: Number(process.env.SEND_MIN_INTERVAL_MS) || 1500
};
