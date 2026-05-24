const axios = require('axios');
const config = require('../config');

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

function isConfigured() {
  return Boolean(config.backendWebhookUrl && config.webhookSecret);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postInbound(payload) {
  if (!isConfigured()) {
    console.error('inboundWebhook: BACKEND_WEBHOOK_URL o WEBHOOK_SECRET no configurados');
    return { ok: false, skipped: true };
  }

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await axios.post(config.backendWebhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': config.webhookSecret
        },
        timeout: config.webhookTimeoutMs,
        validateStatus: () => true
      });
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, status: res.status, data: res.data };
      }
      lastError = new Error(`HTTP ${res.status}: ${res.data?.message || 'error backend'}`);
    } catch (err) {
      lastError = err;
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS);
    }
  }

  console.error('inboundWebhook postInbound:', lastError?.message || 'fallo tras reintentos');
  return { ok: false, error: lastError?.message || 'fallo tras reintentos' };
}

module.exports = {
  isConfigured,
  postInbound
};
