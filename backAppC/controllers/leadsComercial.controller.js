const whatsappBotLeadComercial = require('../services/whatsappBotLeadComercial.service');
const { puedeAccesoListadoPlataformaEmpresas } = require('../utils/plataformaEmpresa.util');

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
    console.error('leadsComercial listar:', err.message);
    if (err.code === 'NO_PRINCIPAL') {
      return res.status(503).json({ message: 'No hay empresa principal configurada.' });
    }
    return res.status(500).json({ message: 'No se pudieron listar los leads.' });
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
    console.error('leadsComercial actualizarEstado:', err.message);
    if (err.code === 'ESTADO_INVALIDO') {
      return res.status(400).json({ message: 'Estado no válido.' });
    }
    if (err.code === 'NO_ENCONTRADO') {
      return res.status(404).json({ message: 'Lead no encontrado.' });
    }
    if (err.code === 'NO_PRINCIPAL') {
      return res.status(503).json({ message: 'No hay empresa principal configurada.' });
    }
    return res.status(500).json({ message: 'No se pudo actualizar el lead.' });
  }
}

module.exports = { listar, actualizarEstado };
