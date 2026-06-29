const { logRequestContext } = require('./requestContext.middleware');

function requestMetricsMiddleware(req, res, next) {
  if (process.env.REQUEST_METRICS_ENABLED !== '1') {
    return next();
  }

  const startedAt = process.hrtime.bigint();
  const slowMs = Math.max(0, parseInt(process.env.REQUEST_METRICS_SLOW_MS, 10) || 1000);

  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    if (elapsedMs >= slowMs) {
      logRequestContext(req, 'info', 'request_duration', {
        statusCode: res.statusCode,
        durationMs: Math.round(elapsedMs)
      });
    }
  });

  next();
}

module.exports = { requestMetricsMiddleware };
