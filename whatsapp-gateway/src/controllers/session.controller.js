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

async function startSession(req, res) {
  const idEmpresa = validateTenantId(req, res);
  if (!idEmpresa) return;
  const nombreDispositivo = req.body?.nombreDispositivo;
  try {
    const data = await sessionManager.startSession(idEmpresa, { nombreDispositivo });
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('session.controller start:', err.message);
    return res.status(500).json({ status: 500, success: false, message: err.message || 'Error al iniciar sesion' });
  }
}

async function getStatus(req, res) {
  const idEmpresa = validateTenantId(req, res);
  if (!idEmpresa) return;
  const data = sessionManager.getSessionStatus(idEmpresa);
  return res.status(200).json({ status: 200, success: true, data });
}

async function logout(req, res) {
  const idEmpresa = validateTenantId(req, res);
  if (!idEmpresa) return;
  try {
    await sessionManager.logoutSession(idEmpresa);
    return res.status(200).json({ status: 200, success: true, message: 'Sesion cerrada' });
  } catch (err) {
    console.error('session.controller logout:', err.message);
    return res.status(500).json({ status: 500, success: false, message: err.message || 'Error al cerrar sesion' });
  }
}

module.exports = { startSession, getStatus, logout };
