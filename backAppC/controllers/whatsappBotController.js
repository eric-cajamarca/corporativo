const whatsappBotService = require('../services/whatsappBot.service');

function mapError(err, res) {
  if (err.code === 'FORBIDDEN') {
    return res.status(403).json({ status: 403, success: false, message: err.message });
  }
  const msg = err.message || 'Error';
  let status = 400;
  if (msg.includes('no activo') || msg.includes('baileys') || msg.includes('desactivado')) status = 403;
  if (msg.includes('Gateway WhatsApp no configurado')) status = 503;
  return res.status(status).json({ status, success: false, message: msg });
}

function requireEmpresa(req, res) {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    res.status(401).json({ status: 401, success: false, message: 'No autorizado' });
    return null;
  }
  return idEmpresa;
}

async function inbound(req, res) {
  const { idEmpresa, from, messageId, text, timestamp, attachment } = req.body || {};
  try {
    const resultado = await whatsappBotService.procesarInbound({
      idEmpresa,
      from,
      messageId,
      text,
      timestamp,
      attachment
    });
    return res.status(200).json({ status: 200, success: true, data: resultado });
  } catch (err) {
    console.error('whatsappBotController inbound:', err.message);
    return mapError(err, res);
  }
}

async function getConfig(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  try {
    const data = await whatsappBotService.getConfig(idEmpresa);
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('whatsappBotController getConfig:', err.message);
    return mapError(err, res);
  }
}

async function updateConfig(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  try {
    const data = await whatsappBotService.updateConfig(idEmpresa, req.body || {});
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('whatsappBotController updateConfig:', err.message);
    return mapError(err, res);
  }
}

async function syncCatalogo(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  try {
    const data = await whatsappBotService.syncCatalogo(idEmpresa);
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('whatsappBotController syncCatalogo:', err.message);
    return mapError(err, res);
  }
}

async function catalogoStatus(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  try {
    const data = await whatsappBotService.catalogoStatus(idEmpresa);
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('whatsappBotController catalogoStatus:', err.message);
    return mapError(err, res);
  }
}

async function listarSinonimos(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  try {
    const data = await whatsappBotService.listarSinonimos(idEmpresa);
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('whatsappBotController listarSinonimos:', err.message);
    return mapError(err, res);
  }
}

async function crearSinonimo(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  const { terminoEntrada, terminoBusqueda } = req.body || {};
  try {
    const data = await whatsappBotService.crearSinonimo(idEmpresa, terminoEntrada, terminoBusqueda);
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('whatsappBotController crearSinonimo:', err.message);
    return mapError(err, res);
  }
}

async function eliminarSinonimo(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  try {
    const data = await whatsappBotService.eliminarSinonimo(idEmpresa, req.params.idSinonimo);
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('whatsappBotController eliminarSinonimo:', err.message);
    return mapError(err, res);
  }
}

async function listarLogs(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  try {
    const limite = req.query.limit ? Number(req.query.limit) : 50;
    const data = await whatsappBotService.listarLogs(idEmpresa, limite);
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('whatsappBotController listarLogs:', err.message);
    return mapError(err, res);
  }
}

async function listarEscaladas(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  try {
    const data = await whatsappBotService.listarEscaladas(idEmpresa);
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('whatsappBotController listarEscaladas:', err.message);
    return mapError(err, res);
  }
}

async function desescalarManual(req, res) {
  const idEmpresa = requireEmpresa(req, res);
  if (!idEmpresa) return;
  try {
    const { telefonoCliente } = req.body || {};
    const data = await whatsappBotService.desescalarManual(idEmpresa, telefonoCliente);
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('whatsappBotController desescalarManual:', err.message);
    return mapError(err, res);
  }
}

module.exports = {
  inbound,
  getConfig,
  updateConfig,
  syncCatalogo,
  catalogoStatus,
  listarSinonimos,
  crearSinonimo,
  eliminarSinonimo,
  listarLogs,
  listarEscaladas,
  desescalarManual
};
