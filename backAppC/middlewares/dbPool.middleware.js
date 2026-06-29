const { getPool } = require('../utils/dbPool.util');

function dbPoolMiddleware(req, res, next) {
  if (process.env.DB_POOL_REQUEST_SCOPE !== '1') {
    return next();
  }

  return getPool()
    .then((pool) => {
      req.dbPool = pool;
      next();
    })
    .catch((error) => {
      console.error('context:', JSON.stringify({
        level: 'error',
        message: 'db_pool_request_scope_error',
        detail: error?.message || String(error)
      }));
      next();
    });
}

module.exports = { dbPoolMiddleware };
