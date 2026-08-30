const chatComercialPublicoService = require('../services/chatComercialPublico.service');

async function chatear(req, res) {
  try {
    const data = await chatComercialPublicoService.procesar(req.body || {});
    return res.status(200).json({ data });
  } catch (err) {
    console.error('chatComercialPublico:', err.message);
    if (err.code === 'RATE_LIMIT') {
      return res.status(429).json({ message: err.message });
    }
    if (err.code === 'NO_PRINCIPAL' || err.code === 'GEMINI_NO_CONFIG') {
      return res.status(503).json({ message: err.message });
    }
    if (err.code === 'MENSAJE_VACIO') {
      return res.status(400).json({ message: err.message });
    }
    return res.status(400).json({ message: err.message || 'No se pudo responder.' });
  }
}

module.exports = { chatear };
