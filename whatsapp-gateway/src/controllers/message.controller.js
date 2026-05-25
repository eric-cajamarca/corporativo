const sessionManager = require('../services/sessionManager.service');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateTenantId(req, res) {
  const id = req.params.idEmpresa;
  if (!id || !UUID_RE.test(String(id))) {
    res.status(400).json({ status: 400, success: false, message: 'idEmpresa invalido' });
    return null;
  }
  return id;
}

async function sendText(req, res) {
  const idEmpresa = validateTenantId(req, res);
  if (!idEmpresa) return;
  const { number, text, skipThrottle } = req.body || {};
  if (!number || !text) {
    return res.status(400).json({ status: 400, success: false, message: 'number y text son requeridos' });
  }
  try {
    const resultado = await sessionManager.sendText(idEmpresa, number, text, {
      skipThrottle: skipThrottle === true || req.get('X-Bot-Reply') === '1'
    });
    return res.status(200).json(resultado);
  } catch (err) {
    console.error('message.controller sendText:', err.message);
    return res.status(400).json({ status: 400, success: false, message: err.message || 'Error al enviar mensaje' });
  }
}

async function sendMedia(req, res) {
  const idEmpresa = validateTenantId(req, res);
  if (!idEmpresa) return;
  const { number, mediatype, media, filename, caption, skipThrottle } = req.body || {};
  if (!number || !media) {
    return res.status(400).json({ status: 400, success: false, message: 'number y media son requeridos' });
  }
  try {
    const resultado = await sessionManager.sendMedia(idEmpresa, number, mediatype, media, filename, caption, {
      skipThrottle: skipThrottle === true || req.get('X-Bot-Reply') === '1'
    });
    return res.status(200).json(resultado);
  } catch (err) {
    console.error('message.controller sendMedia:', err.message);
    return res.status(400).json({ status: 400, success: false, message: err.message || 'Error al enviar archivo' });
  }
}

module.exports = { sendText, sendMedia };
