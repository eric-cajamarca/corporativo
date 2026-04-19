const { randomUUID } = require('crypto');

/**
 * Asigna req.requestId (header X-Request-Id o UUID) y lo devuelve en la respuesta para correlación de logs.
 */
function requestContextMiddleware(req, res, next) {
  const incoming = req.get('X-Request-Id') || req.get('X-Correlation-Id');
  const id = incoming && String(incoming).trim() ? String(incoming).trim().slice(0, 128) : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

/**
 * Log en una línea JSON para búsqueda en agregadores (requestId, ruta, empresa opcional).
 */
function logRequestContext(req, level, message, extra = {}) {
  const base = {
    level,
    message,
    requestId: req.requestId,
    method: req.method,
    path: (req.originalUrl || req.url || '').split('?')[0]
  };
  const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
  if (idEmpresa) base.idEmpresa = String(idEmpresa);
  console.error('context:', JSON.stringify({ ...base, ...extra }));
}

module.exports = { requestContextMiddleware, logRequestContext };
