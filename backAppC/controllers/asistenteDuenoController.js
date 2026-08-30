const asistenteDuenoService = require('../services/asistenteDueno.service');

function idEmpresaDe(req) {
  return req.user?.empresa || req.user?.idEmpresa || null;
}

async function estado(req, res) {
  try {
    const data = asistenteDuenoService.estadoConfig();
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('asistenteDuenoController estado:', err);
    return res.status(500).json({ message: 'No se pudo verificar el asistente.' });
  }
}

async function chat(req, res) {
  const idEmpresa = idEmpresaDe(req);
  if (!idEmpresa) {
    return res.status(401).json({ message: 'No autorizado.' });
  }
  try {
    const data = await asistenteDuenoService.chat(idEmpresa, {
      mensaje: req.body?.mensaje,
      historial: req.body?.historial,
      rutaActual: req.body?.rutaActual,
      tituloPagina: req.body?.tituloPagina
    });
    return res.status(200).json({ status: 200, success: true, data });
  } catch (err) {
    console.error('asistenteDuenoController chat:', err.message);
    if (err.code === 'GEMINI_NO_CONFIG') {
      return res.status(503).json({ message: err.message });
    }
    if (err.code === 'RATE_LIMIT') {
      return res.status(429).json({ message: err.message });
    }
    const msg = err.message || 'No se pudo consultar el asistente.';
    if (/high demand|try again later|unavailable|429/i.test(msg)) {
      return res.status(503).json({
        message: 'Gemini está saturado en este momento. Espere unos segundos e intente de nuevo.'
      });
    }
    const status = /Gemini|fetch|network|ECONN/i.test(msg) ? 502 : 400;
    return res.status(status).json({ message: msg });
  }
}

module.exports = { estado, chat };
