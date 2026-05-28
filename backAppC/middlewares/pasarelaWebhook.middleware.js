const express = require('express');
const pasarelaWebhookVerify = require('../services/pasarelaWebhookVerify.service');

const rawParser = express.raw({ type: () => true, limit: '2mb' });

function esRutaWebhook(req) {
  return req.originalUrl.startsWith('/api/webhooks');
}

/**
 * Captura el cuerpo crudo antes de express.json (necesario para HMAC).
 */
function pasarelaWebhookRawBody(req, res, next) {
  rawParser(req, res, (err) => {
    if (err) {
      return next(err);
    }
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    req.rawBody = buf;
    const ct = (req.get('content-type') || '').toLowerCase();
    if (ct.includes('application/x-www-form-urlencoded')) {
      req.body = Object.fromEntries(new URLSearchParams(buf.toString('utf8')));
    } else if (ct.includes('application/json') || buf.length > 0) {
      try {
        req.body = JSON.parse(buf.toString('utf8'));
      } catch {
        req.body = {};
      }
    } else {
      req.body = {};
    }
    return next();
  });
}

async function verificarWebhookPasarela(req, res, next) {
  const segmento = (req.path || '').replace(/^\//, '').split('/')[0];
  try {
    const ok = await pasarelaWebhookVerify.verificar(req, segmento);
    if (!ok) {
      return res.status(401).json({ message: 'Firma de webhook inválida' });
    }
    return next();
  } catch (error) {
    console.error('verificarWebhookPasarela:', error.message);
    return res.status(401).json({ message: 'Firma de webhook inválida' });
  }
}

module.exports = {
  pasarelaWebhookRawBody,
  verificarWebhookPasarela,
  esRutaWebhook
};
