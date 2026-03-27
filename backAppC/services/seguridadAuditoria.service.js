const seguridadAuditoriaRepository = require('../repositories/seguridadAuditoria.repository');

function ua(req) {
  if (!req || !req.headers) return null;
  return req.headers['user-agent'] || null;
}

exports.registrar = async (pool, req, params) => {
  try {
    await seguridadAuditoriaRepository.insertar(pool, {
      ...params,
      userAgent: params.userAgent != null ? params.userAgent : ua(req)
    });
  } catch (err) {
    console.error('seguridadAuditoria.registrar:', err.message);
  }
};
