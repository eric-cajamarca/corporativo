require('dotenv').config();
const path = require('path');

module.exports = {
  port: Number(process.env.PORT) || 3010,
  apiKey: process.env.GATEWAY_API_KEY || '',
  sessionsDir: path.resolve(process.env.SESSIONS_DIR || path.join(__dirname, '..', 'sessions')),
  logLevel: process.env.LOG_LEVEL || 'warn',
  sendMinIntervalMs: Number(process.env.SEND_MIN_INTERVAL_MS) || 1500,
  backendWebhookUrl: (process.env.BACKEND_WEBHOOK_URL || '').trim(),
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  webhookTimeoutMs: Number(process.env.WEBHOOK_TIMEOUT_MS) || 5000,
  defaultDeviceName: (process.env.DEFAULT_DEVICE_NAME || 'EFAF ERP').trim()
};
