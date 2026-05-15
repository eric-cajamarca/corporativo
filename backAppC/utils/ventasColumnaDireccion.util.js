/**
 * Si la columna ya se comprobó que existe, no se vuelve a consultar en el proceso.
 * Si aún no existe, se reconsulta en cada llamada (tras migrar sin reiniciar Node, la siguiente petición la detecta).
 *
 * Usa el pool global (`dbConnection.sql`) para metadatos: en algunas versiones/driver,
 * `transaction.request()` contra `sys.*` dentro de una transacción activa no es fiable.
 */

const { sql } = require('../dbConnection');

let ventasIdDireccionColumnKnownTrue = false;
let warnedMissingColumn = false;

const SQL_COL_LENGTH_VENTAS_ID_DIR = `SELECT COL_LENGTH(OBJECT_ID(N'dbo.Ventas'), N'idDireccionClientes') AS len`;

/**
 * @param {import('mssql').ConnectionPool|import('mssql').Transaction} conn
 * @returns {Promise<boolean>}
 */
async function ventasTieneColumnaIdDireccionClientes(conn) {
  if (ventasIdDireccionColumnKnownTrue) {
    return true;
  }
  try {
    let r;
    try {
      const pool = sql.pool;
      if (pool && typeof pool.request === 'function') {
        r = await pool.request().query(SQL_COL_LENGTH_VENTAS_ID_DIR);
      } else {
        throw new Error('pool_not_ready');
      }
    } catch (_) {
      r = await conn.request().query(SQL_COL_LENGTH_VENTAS_ID_DIR);
    }
    const len = r.recordset && r.recordset[0] ? r.recordset[0].len : null;
    const has = len != null && Number(len) > 0;
    if (has) {
      ventasIdDireccionColumnKnownTrue = true;
    } else if (!warnedMissingColumn) {
      warnedMissingColumn = true;
      console.error(
        'context: dbo.Ventas no tiene columna idDireccionClientes. Ejecute migraciones nuevas/nuevas/add_ventas_idDireccionClientes.sql (recomendado reiniciar el backend tras migrar).'
      );
    }
    return has;
  } catch (err) {
    console.error('context: ventasTieneColumnaIdDireccionClientes:', err);
    return false;
  }
}

function resetVentasIdDireccionColumnCache() {
  ventasIdDireccionColumnKnownTrue = false;
  warnedMissingColumn = false;
}

module.exports = {
  ventasTieneColumnaIdDireccionClientes,
  resetVentasIdDireccionColumnCache
};
