const WEBHOOK_SECRET = process.env.WHATSAPP_BOT_WEBHOOK_SECRET || '';
const ALLOW_IPS = (process.env.WHATSAPP_BOT_WEBHOOK_ALLOW_IPS || '127.0.0.1,::1,::ffff:127.0.0.1')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function ipCliente(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || '';
}

function ipPermitida(req) {
  if (process.env.WHATSAPP_BOT_WEBHOOK_SKIP_IP_CHECK === 'true') return true;
  const ip = ipCliente(req);
  if (!ip) return false;
  return ALLOW_IPS.some((allowed) => ip === allowed || ip.endsWith(allowed));
}

function verificarWebhookSecret(req, res, next) {
  if (!WEBHOOK_SECRET) {
    return res.status(503).json({
      status: 503,
      success: false,
      message: 'Webhook del bot WhatsApp no configurado en el servidor'
    });
  }

  if (!ipPermitida(req)) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: 'Origen no autorizado'
    });
  }

  const recibido = req.get('X-Webhook-Secret') || '';
  if (recibido !== WEBHOOK_SECRET) {
    return res.status(401).json({
      status: 401,
      success: false,
      message: 'No autorizado'
    });
  }

  return next();
}

module.exports = {
  verificarWebhookSecret
};
