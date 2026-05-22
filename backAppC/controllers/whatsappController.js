const whatsappProvider = require('../services/whatsappProvider.service');

function mapError(err, res) {
  if (err.code === 'FORBIDDEN') {
    return res.status(403).json({ status: 403, success: false, message: err.message });
  }
  if (err.code === 'NOT_CONFIGURED') {
    return res.status(503).json({ status: 503, success: false, message: err.message });
  }
  const msg = err.message || 'Error';
  return res.status(400).json({ status: 400, success: false, message: msg });
}

function requireEmpresa(req, res) {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    res.status(401).json({ status: 401, success: false, message: 'No autorizado' });
    return null;
  }
  return idEmpresa;
}

async function sendText(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  const { number, text } = req.body || {};
  try {
    const resultado = await whatsappProvider.sendText(idEmpresa, number, text);
    return res.status(resultado.status === 200 ? 200 : 400).json(resultado);
  } catch (err) {
    console.error('whatsappController sendText:', err.message);
    return mapError(err, res);
  }
}

async function sendMedia(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  const { number, mediatype, media, filename, caption } = req.body || {};
  try {
    const resultado = await whatsappProvider.sendMedia(idEmpresa, number, mediatype, media, filename, caption);
    return res.status(resultado.status === 200 ? 200 : 400).json(resultado);
  } catch (err) {
    console.error('whatsappController sendMedia:', err.message);
    return mapError(err, res);
  }
}

async function startSession(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  try {
    const data = await whatsappProvider.startSession(idEmpresa);
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('whatsappController startSession:', err.message);
    return mapError(err, res);
  }
}

async function getSessionStatus(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  try {
    const data = await whatsappProvider.getSessionStatus(idEmpresa);
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('whatsappController getSessionStatus:', err.message);
    return mapError(err, res);
  }
}

async function logoutSession(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  try {
    await whatsappProvider.logoutSession(idEmpresa);
    return res.status(200).json({ status: 200, success: true, message: 'Sesion cerrada' });
  } catch (err) {
    console.error('whatsappController logoutSession:', err.message);
    return mapError(err, res);
  }
}

async function setProveedor(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  const { proveedor } = req.body || {};
  try {
    const data = await whatsappProvider.setProveedor(idEmpresa, proveedor);
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('whatsappController setProveedor:', err.message);
    return mapError(err, res);
  }
}

module.exports = {
  sendText,
  sendMedia,
  startSession,
  getSessionStatus,
  logoutSession,
  setProveedor
};
