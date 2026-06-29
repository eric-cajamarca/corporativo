const sql = require('mssql');
const dbConfig = require('../dbconfig');

/**
 * Ejecuta callback(pool) con una conexión MSSQL (mismo patrón que sql.connect en el proyecto).
 * Evita importar mssql/dbconfig en controladores que solo orquestan servicios.
 */
async function getPool() {
  return sql.connect(dbConfig);
}

async function withPool(callback) {
  const pool = await getPool();
  return callback(pool);
}

module.exports = { getPool, withPool };
