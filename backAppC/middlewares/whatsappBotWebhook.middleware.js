const WEBHOOK_SECRET = process.env.WHATSAPP_BOT_WEBHOOK_SECRET || '';

function verificarWebhookSecret(req, res, next) {
  if (!WEBHOOK_SECRET) {
    return res.status(503).json({
      status: 503,
      success: false,
      message: 'Webhook del bot WhatsApp no configurado en el servidor'
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

module.exports = { verificarWebhookSecret };
