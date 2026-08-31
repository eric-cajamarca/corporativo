const sql = require('mssql');
const dbConfig = require('../dbconfig');
const seguridadAlertasService = require('../services/seguridadAlertas.service');

/**
 * Debe montarse al final de las rutas. Errores con status < 500 no disparan WhatsApp.
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = typeof err.status === 'number' ? err.status : typeof err.statusCode === 'number' ? err.statusCode : 500;
  const message = err.message || 'Error interno del servidor';

  console.error(
    'context:',
    JSON.stringify({
      level: 'error',
      message: 'errorHandler',
      requestId: req.requestId,
      path: (req.originalUrl || req.url || '').split('?')[0],
      method: req.method,
      status,
      errMessage: status >= 500 ? 'Error interno' : message
    })
  );
  if (err.stack && process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  if (status >= 500) {
    sql
      .connect(dbConfig)
      .then((pool) => seguridadAlertasService.notificarErrorSistemaDesdeRequest(pool, err, req))
      .catch((e) => console.error('errorHandler: alerta WhatsApp:', e.message));
  }

  const body = {
    message: status >= 500 ? 'Error interno del servidor' : message,
    data: undefined,
    requestId: req.requestId
  };
  res.status(status).json(body);
}

module.exports = errorHandler;
