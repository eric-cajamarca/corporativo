const sql = require('mssql');

async function listarPorEmpresa(pool, idEmpresa) {
  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT idSinonimo, idEmpresa, terminoEntrada, terminoBusqueda,
               CONVERT(VARCHAR(19), fActualizacion, 120) AS fActualizacion
        FROM WhatsAppBotSinonimo WHERE idEmpresa = @idEmpresa ORDER BY terminoEntrada
      `);
    return r.recordset;
  } catch (e) {
    if (e && e.number === 208) return [];
    throw e;
  }
}

async function mapaPorEmpresa(pool, idEmpresa) {
  const rows = await listarPorEmpresa(pool, idEmpresa);
  const map = new Map();
  for (const row of rows) {
    const k = String(row.terminoEntrada || '').trim().toLowerCase();
    if (k) map.set(k, String(row.terminoBusqueda || '').trim().toLowerCase());
  }
  return map;
}

async function insertar(pool, idEmpresa, terminoEntrada, terminoBusqueda) {
  await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('terminoEntrada', sql.NVarChar(120), String(terminoEntrada).trim().slice(0, 120))
    .input('terminoBusqueda', sql.NVarChar(120), String(terminoBusqueda).trim().slice(0, 120))
    .query(`
      INSERT INTO WhatsAppBotSinonimo (idEmpresa, terminoEntrada, terminoBusqueda)
      VALUES (@idEmpresa, @terminoEntrada, @terminoBusqueda)
    `);
}

async function eliminar(pool, idEmpresa, idSinonimo) {
  await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSinonimo', sql.UniqueIdentifier, idSinonimo)
    .query('DELETE FROM WhatsAppBotSinonimo WHERE idEmpresa = @idEmpresa AND idSinonimo = @idSinonimo');
}

module.exports = { listarPorEmpresa, mapaPorEmpresa, insertar, eliminar };
