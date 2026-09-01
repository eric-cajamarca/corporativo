const whatsappBotLeadComercial = require('../services/whatsappBotLeadComercial.service');
const { puedeAccesoListadoPlataformaEmpresas } = require('../utils/plataformaEmpresa.util');

function errorPlataforma(res, err, fallback) {
  console.error(fallback, err.message);
  if (err.code === 'NO_PRINCIPAL') {
    return res.status(503).json({ message: 'No hay empresa principal configurada.' });
  }
  if (err.code === 'ESTADO_INVALIDO') {
    return res.status(400).json({ message: 'Estado no válido.' });
  }
  if (err.code === 'NO_ENCONTRADO') {
    return res.status(404).json({ message: 'Lead no encontrado.' });
  }
  return res.status(500).json({ message: 'No se pudo completar la operación.' });
}

async function listar(req, res) {
  try {
    if (!puedeAccesoListadoPlataformaEmpresas(req)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }
    const data = await whatsappBotLeadComercial.listarParaPlataforma({
      estado: req.query?.estado
    });
    return res.status(200).json({ data });
  } catch (err) {
    return errorPlataforma(res, err, 'leadsComercial listar:');
  }
}

async function metricas(req, res) {
  try {
    if (!puedeAccesoListadoPlataformaEmpresas(req)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }
    const data = await whatsappBotLeadComercial.metricasParaPlataforma(req.query);
    return res.status(200).json({ data });
  } catch (err) {
    return errorPlataforma(res, err, 'leadsComercial metricas:');
  }
}

async function revision(req, res) {
  try {
    if (!puedeAccesoListadoPlataformaEmpresas(req)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }
    const data = await whatsappBotLeadComercial.revisionParaPlataforma();
    return res.status(200).json({ data });
  } catch (err) {
    return errorPlataforma(res, err, 'leadsComercial revision:');
  }
}

async function chat(req, res) {
  try {
    if (!puedeAccesoListadoPlataformaEmpresas(req)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }
    const data = await whatsappBotLeadComercial.chatParaPlataforma(req.params?.idLead);
    return res.status(200).json({ data });
  } catch (err) {
    return errorPlataforma(res, err, 'leadsComercial chat:');
  }
}

async function actualizarEstado(req, res) {
  try {
    if (!puedeAccesoListadoPlataformaEmpresas(req)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }
    const data = await whatsappBotLeadComercial.actualizarEstadoPlataforma(
      req.params?.idLead,
      req.body?.estado
    );
    return res.status(200).json({ data });
  } catch (err) {
    return errorPlataforma(res, err, 'leadsComercial actualizarEstado:');
  }
}

async function guardarRevision(req, res) {
  try {
    if (!puedeAccesoListadoPlataformaEmpresas(req)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }
    const data = await whatsappBotLeadComercial.guardarRevisionPlataforma(req.params?.idLead, {
      notaRevision: req.body?.notaRevision,
      estado: req.body?.estado
    });
    return res.status(200).json({ data });
  } catch (err) {
    return errorPlataforma(res, err, 'leadsComercial guardarRevision:');
  }
}

module.exports = { listar, metricas, revision, chat, actualizarEstado, guardarRevision };
