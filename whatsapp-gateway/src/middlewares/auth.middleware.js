const config = require('../config');

function requireApiKey(req, res, next) {
  if (!config.apiKey) {
    return res.status(503).json({ status: 503, success: false, message: 'Gateway sin GATEWAY_API_KEY configurada' });
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || token !== config.apiKey) {
    return res.status(401).json({ status: 401, success: false, message: 'No autorizado' });
  }
  next();
}
module.exports = { requireApiKey };
