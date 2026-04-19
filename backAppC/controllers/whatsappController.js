const { withPool } = require('../utils/dbPool.util');
const factilizaRepository = require('../repositories/factiliza.repository');
const whatsappFactilizaService = require('../services/whatsappFactiliza.service');

const NOMBRE_SERVICIO_WHATSAPP = 'Factiliza WHATSAPP';

/**
 * POST /send-text
 * Body: { number, text }
 * idEmpresa desde req.user.empresa. Solo si la empresa tiene puedeUsar y hay config WhatsApp.
 */
async function sendText(req, res) {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ status: 401, success: false, message: 'No autorizado' });
  }
  const { number, text } = req.body || {};
  try {
    const gate = await withPool(async (pool) => {
      const puedeUsar = await factilizaRepository.puedeUsarServicio(pool, idEmpresa, NOMBRE_SERVICIO_WHATSAPP);
      if (!puedeUsar) return { ok: false, reason: 'FORBIDDEN' };
      const config = await factilizaRepository.getConfigByNombre(pool, NOMBRE_SERVICIO_WHATSAPP);
      if (!config || !config.tokenDefault) return { ok: false, reason: 'NOT_CONFIGURED' };
      return { ok: true, config };
    });
    if (!gate.ok) {
      if (gate.reason === 'FORBIDDEN') {
        return res.status(403).json({ status: 403, success: false, message: 'Su empresa no tiene autorización para usar WhatsApp' });
      }
      return res.status(503).json({ status: 503, success: false, message: 'Servicio WhatsApp no configurado' });
    }
    const resultado = await whatsappFactilizaService.sendText(gate.config, number, text);
    return res.status(resultado.status === 200 ? 200 : 400).json(resultado);
  } catch (err) {
    console.error('whatsappController sendText:', err.message);
    const msg = err.message || 'Error al enviar mensaje';
    return res.status(400).json({ status: 400, success: false, message: msg });
  }
}

/**
 * POST /send-media
 * Body: { number, mediatype, media [, filename, caption] }
 * media: base64 o URL. mediatype: 'image'|'document'|'video'|'audio'
 */
async function sendMedia(req, res) {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ status: 401, success: false, message: 'No autorizado' });
  }
  const { number, mediatype, media, filename, caption } = req.body || {};
  try {
    const gate = await withPool(async (pool) => {
      const puedeUsar = await factilizaRepository.puedeUsarServicio(pool, idEmpresa, NOMBRE_SERVICIO_WHATSAPP);
      if (!puedeUsar) return { ok: false, reason: 'FORBIDDEN' };
      const config = await factilizaRepository.getConfigByNombre(pool, NOMBRE_SERVICIO_WHATSAPP);
      if (!config || !config.tokenDefault) return { ok: false, reason: 'NOT_CONFIGURED' };
      return { ok: true, config };
    });
    if (!gate.ok) {
      if (gate.reason === 'FORBIDDEN') {
        return res.status(403).json({ status: 403, success: false, message: 'Su empresa no tiene autorización para usar WhatsApp' });
      }
      return res.status(503).json({ status: 503, success: false, message: 'Servicio WhatsApp no configurado' });
    }
    const resultado = await whatsappFactilizaService.sendMedia(gate.config, number, mediatype, media, filename, caption);
    return res.status(resultado.status === 200 ? 200 : 400).json(resultado);
  } catch (err) {
    console.error('whatsappController sendMedia:', err.message);
    const msg = err.message || 'Error al enviar archivo';
    return res.status(400).json({ status: 400, success: false, message: msg });
  }
}

module.exports = {
  sendText,
  sendMedia
};
